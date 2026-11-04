// What a draft lacks before it can be published (M4 spec, "The editor"): a title, then a date. The
// editor says which and puts the focus on it; nothing is published until neither is missing.
export function missingToPublish(event: { title: string; startsAt: Date | null }): "title" | "date" | undefined {
  if (!event.title.trim()) return "title";
  if (!event.startsAt) return "date";
  return undefined;
}
