import { describe, expect, it } from "vitest";
import { promotable } from "./waitlist";

const party = (id: string, size: number) => ({ id, party: size });

describe("promotable", () => {
  it("promotes in the order the waitlist holds, while each party fits", () => {
    expect(promotable([party("a", 1), party("b", 2), party("c", 1)], 3)).toEqual(["a", "b"]);
  });

  it("stops at a large party at the front rather than skip it for a smaller one behind", () => {
    expect(promotable([party("a", 3), party("b", 1)], 1)).toEqual([]);
    expect(promotable([party("a", 1), party("b", 3), party("c", 1)], 2)).toEqual(["a"]);
  });

  it("promotes parties of one, one place each", () => {
    expect(promotable([party("a", 1), party("b", 1), party("c", 1)], 2)).toEqual(["a", "b"]);
  });

  it("promotes a party that fits exactly", () => {
    expect(promotable([party("a", 4)], 4)).toEqual(["a"]);
    expect(promotable([party("a", 4)], 3)).toEqual([]);
  });

  it("promotes everyone when there is no capacity", () => {
    expect(promotable([party("a", 3), party("b", 11)], Infinity)).toEqual(["a", "b"]);
  });

  it("promotes nobody with no room, or room taken past the capacity", () => {
    expect(promotable([party("a", 1)], 0)).toEqual([]);
    expect(promotable([party("a", 1)], -2)).toEqual([]);
  });

  it("promotes nobody from an empty waitlist", () => {
    expect(promotable([], 5)).toEqual([]);
  });
});
