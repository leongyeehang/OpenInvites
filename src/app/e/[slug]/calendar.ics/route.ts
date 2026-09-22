import { notFound } from "next/navigation";
import { buildIcs } from "@/calendar/ics";
import { acceptsRsvps } from "@/events/access";
import { findEventBySlug } from "@/events/repository";
import { isSlug } from "@/events/slug";
import { baseUrl } from "@/instance/env";

// The event as a calendar file. Served from the event link itself, so whatever can open the
// invitation can download it, and a draft stays as private as its page.
export async function GET(_request: Request, context: RouteContext<"/e/[slug]/calendar.ics">) {
  const { slug } = await context.params;
  if (!isSlug(slug)) notFound();
  const event = await findEventBySlug(slug);
  // Only a published event: a draft is not public, and nobody wants a cancelled party in their
  // calendar.
  if (!event || !acceptsRsvps(event.state)) notFound();

  const link = `${baseUrl()}/e/${event.slug}`;
  return new Response(buildIcs(event, link, new Date()), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${event.slug}.ics"`,
    },
  });
}
