// The waitlist's one rule (spec, "Capacity and the waitlist"): when space opens, the waiting
// parties are taken in the order they joined, each whole, while the next one fits; then it stops.
// A large party at the front is not skipped for a smaller one behind it, because the order of
// arrival is what the waitlist promises (decided in the spec). `space` is what capacity leaves
// beside the headcount, Infinity when the event has none. Returns the ids to promote, in order.
export function promotable(waitlist: { id: string; party: number }[], space: number): string[] {
  const promoted: string[] = [];
  let left = space;
  for (const { id, party } of waitlist) {
    if (party > left) break;
    promoted.push(id);
    left -= party;
  }
  return promoted;
}
