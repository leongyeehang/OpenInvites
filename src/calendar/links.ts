import { basicDateIn, dateIn, detailsOf, utcStamp, type CalendarEvent } from "./calendar";

// Google Calendar's prefilled entry. An all-day range is dates; a timed one is instants, and an
// event with no end sits at its start, as it does in the file.
export function googleCalendarHref(event: CalendarEvent, link: string): string {
  const dates = event.allDay
    ? `${basicDateIn(event.startsAt, event.timeZone)}/${basicDateIn(event.endsAt ?? event.startsAt, event.timeZone, 1)}`
    : `${utcStamp(event.startsAt)}/${utcStamp(event.endsAt ?? event.startsAt)}`;
  const query = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates,
    details: detailsOf(event, link),
    location: event.location,
  });
  return `https://calendar.google.com/calendar/render?${query}`;
}

// Outlook on the web, which takes ISO instants and a flag for all-day.
export function outlookHref(event: CalendarEvent, link: string): string {
  const query = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: event.title,
    body: detailsOf(event, link),
    location: event.location,
    startdt: event.allDay ? dateIn(event.startsAt, event.timeZone) : event.startsAt.toISOString(),
    enddt: event.allDay
      ? dateIn(event.endsAt ?? event.startsAt, event.timeZone, 1)
      : (event.endsAt ?? event.startsAt).toISOString(),
    ...(event.allDay ? { allday: "true" } : {}),
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${query}`;
}
