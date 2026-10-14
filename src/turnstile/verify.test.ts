import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { turnstileVerdict, verifyTurnstile } from "./verify";

// What Cloudflare's siteverify answered, its status and its body as JSON: only a success it
// states outright, in a successful answer, passes.
describe("turnstileVerdict", () => {
  it("passes a token Cloudflare says succeeded", () => {
    expect(turnstileVerdict(200, { success: true, "error-codes": [], hostname: "invites.example.org" })).toBe("ok");
  });

  it("fails a token Cloudflare says did not", () => {
    expect(turnstileVerdict(200, { success: false, "error-codes": ["timeout-or-duplicate"] })).toBe("failed");
  });

  it("fails an answer that says nothing of success, or not in so many words", () => {
    expect(turnstileVerdict(200, { "error-codes": [] })).toBe("failed");
    expect(turnstileVerdict(200, { success: "true" })).toBe("failed");
    expect(turnstileVerdict(200, { success: 1 })).toBe("failed");
  });

  it("fails an answer that is not an object, or was not JSON", () => {
    expect(turnstileVerdict(200, null)).toBe("failed");
    expect(turnstileVerdict(200, undefined)).toBe("failed");
    expect(turnstileVerdict(200, "success")).toBe("failed");
    expect(turnstileVerdict(200, true)).toBe("failed");
    expect(turnstileVerdict(200, [{ success: true }])).toBe("failed");
  });

  it("fails an answer that is not a success, whatever its body says", () => {
    expect(turnstileVerdict(500, { success: true })).toBe("failed");
    expect(turnstileVerdict(403, { success: true })).toBe("failed");
    expect(turnstileVerdict(302, { success: true })).toBe("failed");
  });
});

// The one call to Cloudflare, with fetch stood in for: what it sends, and that every way it can go
// wrong fails the check and is logged once, without the secret.
describe("verifyTurnstile", () => {
  const SECRET = "0x4AAAsecret-never-logged";
  let warned: string[];

  beforeEach(() => {
    vi.stubEnv("TURNSTILE_SITE_KEY", "0x4AAAsite");
    vi.stubEnv("TURNSTILE_SECRET_KEY", SECRET);
    warned = [];
    vi.spyOn(console, "warn").mockImplementation((message: string) => void warned.push(message));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const answering = (respond: () => Promise<Response>) => {
    const fetched = vi.fn(respond);
    vi.stubGlobal("fetch", fetched);
    return fetched;
  };

  it("posts the secret, the token and the address form-encoded to siteverify, and passes what Cloudflare passes", async () => {
    const fetched = answering(async () => Response.json({ success: true }));
    expect(await verifyTurnstile("XXXX.DUMMY.TOKEN.XXXX", "203.0.113.7")).toBe("ok");
    const [url, init] = fetched.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    expect(init.method).toBe("POST");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(Object.fromEntries(init.body as URLSearchParams)).toEqual({ secret: SECRET, response: "XXXX.DUMMY.TOKEN.XXXX", remoteip: "203.0.113.7" });
    expect(warned).toEqual([]);
  });

  it("gives Cloudflare five seconds to answer", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    const fetched = answering(async () => Response.json({ success: true }));
    await verifyTurnstile("token", undefined);
    expect(timeout).toHaveBeenCalledWith(5000);
    const [, init] = fetched.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.signal).toBe(timeout.mock.results[0].value);
  });

  it("fails a form without a token, asking nobody", async () => {
    const fetched = answering(async () => Response.json({ success: true }));
    expect(await verifyTurnstile("", "203.0.113.7")).toBe("failed");
    expect(await verifyTurnstile(null, undefined)).toBe("failed");
    expect(fetched).not.toHaveBeenCalled();
    expect(warned).toEqual(["Turnstile: a check failed: the form came without a token.", "Turnstile: a check failed: the form came without a token."]);
  });

  it("fails when Cloudflare cannot be reached, answers with an error, or answers with something that is not JSON", async () => {
    answering(async () => {
      throw new TypeError("fetch failed");
    });
    expect(await verifyTurnstile("token", undefined)).toBe("failed");
    answering(async () => Response.json({ success: true }, { status: 503 }));
    expect(await verifyTurnstile("token", undefined)).toBe("failed");
    answering(async () => new Response("<html>Bad gateway</html>", { status: 200 }));
    expect(await verifyTurnstile("token", undefined)).toBe("failed");
    answering(async () => Response.json({ success: false, "error-codes": ["invalid-input-secret"] }));
    expect(await verifyTurnstile("token", undefined)).toBe("failed");
    expect(warned).toEqual([
      "Turnstile: a check failed: Cloudflare could not be reached (fetch failed).",
      "Turnstile: a check failed: Cloudflare answered 503.",
      "Turnstile: a check failed: Cloudflare's answer was not JSON.",
      "Turnstile: a check failed: Cloudflare refused the token (invalid-input-secret).",
    ]);
    expect(warned.join("\n")).not.toContain(SECRET);
  });
});
