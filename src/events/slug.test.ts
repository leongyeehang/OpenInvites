import { describe, expect, it } from "vitest";
import { generateSlug, isSlug, SLUG_TAKEN, withFreshSlug } from "./slug";

describe("event link slug", () => {
  it("is ten characters from the 62-character alphabet", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateSlug()).toMatch(/^[A-Za-z0-9]{10}$/);
    }
  });

  it("differs between calls", () => {
    expect(new Set(Array.from({ length: 50 }, generateSlug)).size).toBe(50);
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
