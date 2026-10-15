import { clientAddressOf } from "@/rate-limit/rate-limit";
import { isTurnstileConfigured, turnstileConfig } from "./config";

export type TurnstileVerdict = "ok" | "failed";

// The field the widget writes its token into, in the form it guards (turnstile.tsx).
export const TURNSTILE_FIELD = "cf-turnstile-response";

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TIMEOUT_MS = 5000;

// What Cloudflare's siteverify answered: its HTTP status, and its body read as JSON (undefined when
// it was not). The token passed only when the answer is a success and says so in as many words.
// Anything else, an answer of another shape included, is a failure.
export function turnstileVerdict(status: number, json: unknown): TurnstileVerdict {
  const said = (json as { success?: unknown } | null | undefined)?.success === true;
  return status >= 200 && status < 300 && said ? "ok" : "failed";
}

// Asks Cloudflare whether a token is good, once: a token passes one check only. The address is
// the client's as the rate limits believe it, which Cloudflare compares with the one that solved
// the challenge. No token, no answer within five seconds, or an answer that is not a verdict
// fails the check, and each failure is logged once with its reason, never with the secret.
// checkTurnstile calls it only once the keys are set.
export async function verifyTurnstile(token: string | null, remoteIp: string | undefined): Promise<TurnstileVerdict> {
  if (!token) return failed("the form came without a token");
  const body = new URLSearchParams({ secret: turnstileConfig()!.secretKey, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);
  let answer: Response;
  try {
    answer = await fetch(SITEVERIFY, { method: "POST", body, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (error) {
    return failed(`Cloudflare could not be reached (${error instanceof Error ? error.message : String(error)})`);
  }
  const json: unknown = await answer.json().catch(() => undefined);
  if (turnstileVerdict(answer.status, json) === "ok") return "ok";
  if (!answer.ok) return failed(`Cloudflare answered ${answer.status}`);
  if (json === undefined) return failed("Cloudflare's answer was not JSON");
  const codes = (json as { "error-codes"?: unknown } | null)?.["error-codes"];
  return failed(`Cloudflare refused the token (${Array.isArray(codes) && codes.length > 0 ? codes.join(", ") : "no reason given"})`);
}

function failed(reason: string): TurnstileVerdict {
  console.warn(`Turnstile: a check failed: ${reason}.`);
  return "failed";
}

// The check a guarded form's action makes before it does anything else (spec, "Turnstile"):
// passed when the operator has not turned Turnstile on, otherwise Cloudflare's verdict on the
// token the form posted.
export async function checkTurnstile(formData: FormData, requestHeaders: Headers): Promise<TurnstileVerdict> {
  if (!isTurnstileConfigured()) return "ok";
  const token = formData.get(TURNSTILE_FIELD);
  return verifyTurnstile(typeof token === "string" ? token : null, clientAddressOf(requestHeaders));
}
