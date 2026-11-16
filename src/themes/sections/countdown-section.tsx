import { CountdownFigure } from "@/app/e/[slug]/viewer";
import { isDated, type EventTime } from "@/events/time";
import { pollState } from "@/polls/poll";
import type { SectionDrawing } from "@/sections";
import type { SectionPage } from "./drawings";

// The countdown as a section of its own (M8 spec, "Countdown"; ticket 28): off until the host
// switches it on, and then the countdown leaves When (app/e/[slug]/page.tsx). It counts on the
// guest's own clock, from the event's time alone, as the countdown under When does: a client
// component is sent all it is handed. A cancelled event, one whose date guests are still voting
// on, and a draft with no date yet have nothing to count to, so it loads nothing and is not placed.
export const countdownDrawing: SectionDrawing<{ time: EventTime }, SectionPage> = {
  load: async ({ event }) => {
    if (!isDated(event) || event.state === "cancelled" || pollState(event) === "open") return undefined;
    const { startsAt, endsAt, allDay, timeZone } = event;
    return { time: { startsAt, endsAt, allDay, timeZone } };
  },
  shown: () => ({ count: null }),
  body: ({ time }) => <CountdownFigure event={time} />,
};
