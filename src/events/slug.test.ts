import { afterEach, describe, expect, it, vi } from "vitest";
import { CUSTOM_SLUG_MAX, CUSTOM_SLUG_MIN, eventPath, eventUrl, generateSlug, isCustomSlug, isSlug, normaliseCustomSlug, SLUG_TAKEN, withFreshSlug } from "./slug";

const draws = vi.hoisted(() => ({ queue: [] as number[] }));
vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return { ...actual, randomInt: (max: number) => draws.queue.shift() ?? actual.randomInt(max) };
});

describe("event link slug", () => {
  it("is ten characters from the 62-character alphabet", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateSlug()).toMatch(/^[A-Za-z0-9]{10}$/);
    }
  });

  it("differs between calls", () => {
    expect(new Set(Array.from({ length: 50 }, generateSlug)).size).toBe(50);
  });

  it("never draws a slug of the custom shape", () => {
    // The first draw is ten lowercase letters (index 0 of the alphabet is "A", 26 is "a"); the
    // second has capitals.
    draws.queue.push(...Array.from({ length: 10 }, () => 26), ...Array.from({ length: 10 }, () => 0));
    const slug = generateSlug();
    expect(isCustomSlug(slug)).toBe(false);
    expect(slug).toBe("AAAAAAAAAA");
    for (let i = 0; i < 1000; i++) expect(isCustomSlug(generateSlug())).toBe(false);
  });

  it("recognises a slug and rejects anything else", () => {
    expect(isSlug("aB3dE6fG9h")).toBe(true);
    expect(isSlug("aB3dE6fG9")).toBe(false);
    expect(isSlug("aB3dE6fG9h1")).toBe(false);
    expect(isSlug("aB3dE6fG-h")).toBe(false);
  });
});

describe("withFreshSlug", () => {
  it("tries again with a new slug when the one it drew is taken", async () => {
    const tried: string[] = [];
    const result = await withFreshSlug(async (slug) => {
      tried.push(slug);
      return tried.length < 3 ? SLUG_TAKEN : { slug };
    });
    expect(tried).toHaveLength(3);
    expect(new Set(tried).size).toBe(3);
    expect(result).toEqual({ slug: tried[2] });
  });

  it("gives up after five collisions instead of looping forever", async () => {
    await expect(withFreshSlug(async () => SLUG_TAKEN)).rejects.toThrow(/slug/i);
  });
});

describe("custom link", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("accepts 3 to 40 lowercase letters, digits and single hyphens", () => {
    expect(CUSTOM_SLUG_MIN).toBe(3);
    expect(CUSTOM_SLUG_MAX).toBe(40);
    expect(isCustomSlug("ab")).toBe(false);
    expect(isCustomSlug("abc")).toBe(true);
    expect(isCustomSlug("a".repeat(40))).toBe(true);
    expect(isCustomSlug("a".repeat(41))).toBe(false);
    expect(isCustomSlug("adas-birthday-2026")).toBe(true);
  });

  it("refuses hyphens first, last or doubled, uppercase and non-ASCII", () => {
    expect(isCustomSlug("-abc")).toBe(false);
    expect(isCustomSlug("abc-")).toBe(false);
    expect(isCustomSlug("a--bc")).toBe(false);
    expect(isCustomSlug("Abc")).toBe(false);
    expect(isCustomSlug("café-party")).toBe(false);
    expect(isCustomSlug("生日派对会")).toBe(false);
    expect(isCustomSlug("ab c")).toBe(false);
    expect(isCustomSlug("abc\n")).toBe(false);
  });

  it("normalises by trimming and lowercasing", () => {
    expect(normaliseCustomSlug("  ADAS-Birthday ")).toBe("adas-birthday");
  });

  it("isSlug accepts both shapes", () => {
    expect(isSlug("aB3dE6fG9h")).toBe(true);
    expect(isSlug("adas-birthday")).toBe(true);
    expect(isSlug("ab")).toBe(false);
    expect(isSlug("Adas-Birthday")).toBe(false);
  });

  it("eventPath prefers the custom slug", () => {
    expect(eventPath({ slug: "aB3dE6fG9h", customSlug: null })).toBe("/e/aB3dE6fG9h");
    expect(eventPath({ slug: "aB3dE6fG9h", customSlug: "adas-birthday" })).toBe("/e/adas-birthday");
    vi.stubEnv("BASE_URL", "https://invites.example/");
    expect(eventUrl({ slug: "aB3dE6fG9h", customSlug: "adas-birthday" })).toBe("https://invites.example/e/adas-birthday");
    expect(eventUrl({ slug: "aB3dE6fG9h", customSlug: null })).toBe("https://invites.example/e/aB3dE6fG9h");
  });
});
