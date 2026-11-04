import { pollState } from "@/polls/poll";

// What a draft lacks before it can be published (M4 spec, "The editor"): a title, then a date, or
// a date poll open for guests to vote on (ticket 09). The editor says which and puts the focus on
// it; nothing is published until neither is missing.
export function missingToPublish(event: { title: string; startsAt: Date | null; pollOpenedAt: Date | null; pollClosedAt: Date | null }): "title" | "date" | undefined {
  if (!event.title.trim()) return "title";
  if (!event.startsAt && pollState(event) !== "open") return "date";
  return undefined;
}
