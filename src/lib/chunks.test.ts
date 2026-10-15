import { describe, expect, it } from "vitest";
import { chunks } from "./chunks";

describe("chunks", () => {
  it("cuts a list into runs of the size, the last one shorter", () => {
    expect(chunks([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("gives whole runs when the size divides the list, and one run when it is larger", () => {
    expect(chunks(["a", "b", "c", "d"], 2)).toEqual([["a", "b"], ["c", "d"]]);
    expect(chunks(["a", "b"], 1000)).toEqual([["a", "b"]]);
  });

  it("gives nothing for nothing", () => {
    expect(chunks([], 1000)).toEqual([]);
  });
});
