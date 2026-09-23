import { describe, expect, it } from "vitest";
import { countRequest, isOver, type Rule, type Window } from "./window";

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
