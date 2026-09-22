import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import { eventPageFor } from "@/events/access";
import { findEventBySlug } from "@/events/repository";
import { isSlug } from "@/events/slug";
import { formatWhen } from "@/events/time";
import { PREVIEW_SIZE, previewCard } from "@/sharing/preview-card";
import { resolveTheme } from "@/themes/resolve";

// A crawler brings no language of its own, so the card is written in the source one. The card is
// drawn in the face next/og bundles: the theme's title fonts ship as woff2, which Satori cannot
// read (see the ticket 14 notes).
const CARD_LOCALE = "en";

export async function GET(_request: Request, context: RouteContext<"/e/[slug]/preview.png">) {
  const { slug } = await context.params;
  if (!isSlug(slug)) notFound();
  const event = await findEventBySlug(slug);
  // A draft's card is as private as its page.
  if (!event || eventPageFor(event.state, { isHost: false }) === "notReady") notFound();

  const url = new URL(_request.url);
  // Every card the page links to carries the event's version, so that one never changes. A
  // request without it may be any version, so it is only cached briefly.
  const versioned = url.searchParams.has("v");

  return new ImageResponse(previewCard(event, resolveTheme(event.theme), formatWhen(event, CARD_LOCALE)), {
    ...PREVIEW_SIZE,
    headers: {
      "Cache-Control": versioned ? "public, max-age=31536000, immutable" : "public, max-age=300",
    },
  });
}
