import type { EventState } from "./repository";

// Whether a request for the event page is one more time it was opened (spec, "View count"): a
// document request, as src/proxy.ts defines it (GET or HEAD without the rsc header), for an event
// whose page is up, by someone who is not one of its hosts. A server action redraw, a
// client-side navigation and a prefetch are the browser's own doing, not a person opening the page.
export function countsAsView(
  request: { method: string; headers: Headers },
  event: { state: EventState },
  viewer: { isHost: boolean },
): boolean {
  const { method, headers } = request;
  if (method !== "GET" && method !== "HEAD") return false;
  if (headers.has("rsc") || headers.has("next-router-prefetch")) return false;
  if ([headers.get("purpose"), headers.get("sec-purpose")].some((value) => value?.startsWith("prefetch"))) return false;
  return event.state !== "draft" && !viewer.isHost;
}
