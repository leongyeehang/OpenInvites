import { describe, expect, it } from "vitest";
import { countRequest, isOver, WindowTable, type Rule, type Window } from "./window";

const RULE: Rule = { limit: 3, windowMs: 60_000 };
const START = 1_000_000;

// Runs requests at the given times through one window, as the store would.
function run(times: number[], rule = RULE) {
  let window: Window | undefined;
  return times.map((now) => {
    const outcome = countRequest(window, rule, now);
    window = outcome.window;
    return outcome;
  });
}

describe("countRequest", () => {
  it("lets requests through up to the limit, the first one opening the window", () => {
    const outcomes = run([START, START + 10, START + 20]);
    expect(outcomes.map((each) => each.allowed)).toEqual([true, true, true]);
    expect(outcomes[2].window).toEqual({ startedAt: START, count: 3 });
  });

  it("refuses the one after the limit, saying how long until the window is over", () => {
    const [, , , fourth] = run([START, START + 10, START + 20, START + 15_000]);
    expect(fourth.allowed).toBe(false);
    expect(fourth.retryAfterMs).toBe(45_000);
  });

  it("does not count a refused request, nor let it push the window back", () => {
    const outcomes = run([START, START, START, START + 30_000, START + 59_999]);
    expect(outcomes[4].allowed).toBe(false);
    expect(outcomes[4].window).toEqual({ startedAt: START, count: 3 });
    expect(outcomes[4].retryAfterMs).toBe(1);
  });

  it("opens a fresh window once the old one is over, with the whole limit again", () => {
    const outcomes = run([START, START, START, START + 60_000, START + 60_001, START + 60_002, START + 60_003]);
    expect(outcomes.map((each) => each.allowed)).toEqual([true, true, true, true, true, true, false]);
    expect(outcomes[3].window).toEqual({ startedAt: START + 60_000, count: 1 });
  });

  it("allows exactly the limit, not one more, however the requests are spread", () => {
    const outcomes = run([START, START + 59_000, START + 59_500, START + 59_999], { limit: 2, windowMs: 60_000 });
    expect(outcomes.map((each) => each.allowed)).toEqual([true, true, false, false]);
  });
});

describe("isOver", () => {
  it("says a window can be forgotten from the moment it ends", () => {
    const window = { startedAt: START, count: 3 };
    expect(isOver(window, RULE, START + 59_999)).toBe(false);
    expect(isOver(window, RULE, START + 60_000)).toBe(true);
  });
});

describe("WindowTable", () => {
  const MINUTE = 60_000;
  const ONE: Rule = { limit: 1, windowMs: MINUTE };

  it("counts each client apart", () => {
    const table = new WindowTable(RULE, 100);
    expect([1, 2, 3, 4].map(() => table.count("a", START).allowed)).toEqual([true, true, true, false]);
    expect(table.count("b", START).allowed).toBe(true);
  });

  it("forgets the windows that are over as requests arrive, oldest first", () => {
    const table = new WindowTable(ONE, 100);
    table.count("a", START);
    table.count("b", START + 10_000);
    table.count("c", START + 30_000);
    expect(table.size).toBe(3);
    // a's window ended at START + 60 s and b's at START + 70 s; c's is still open.
    table.count("d", START + 70_000);
    expect(table.size).toBe(2);
  });

  it("puts a window that opens again behind the others, so it is not forgotten early", () => {
    const table = new WindowTable(ONE, 100);
    table.count("a", START);
    table.count("b", START + 30_000);
    table.count("a", START + 61_000);
    // b's window is over at START + 90 s; a's second one is not.
    table.count("c", START + 91_000);
    expect(table.size).toBe(2);
    expect(table.count("a", START + 91_000).allowed).toBe(false);
  });

  it("holds no more clients than it may, forgetting the oldest windows first", () => {
    const table = new WindowTable(ONE, 3);
    for (const [at, client] of ["a", "b", "c", "d"].entries()) table.count(client, START + at);
    expect(table.size).toBe(3);
    // a was pushed out, so it starts again; b, c and d are still counted.
    expect(table.count("b", START + 10).allowed).toBe(false);
    expect(table.count("a", START + 10).allowed).toBe(true);
    expect(table.size).toBe(3);
  });

  it("does not grow or reorder on a refused request", () => {
    const table = new WindowTable(ONE, 2);
    table.count("a", START);
    table.count("b", START + 1);
    expect(table.count("a", START + 2).allowed).toBe(false);
    // Had a moved behind b, the next client would push b out rather than a.
    table.count("c", START + 3);
    expect(table.count("a", START + 4).allowed).toBe(true);
  });
});
