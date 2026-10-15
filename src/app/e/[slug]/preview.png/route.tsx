import { notFound } from "next/navigation";
import { eventPageFor } from "@/events/access";
import { findEventBySlug } from "@/events/repository";
import { isSlug } from "@/events/slug";
import { formatWhen } from "@/events/time";
import { blurredForCard, drawPreviewCard } from "@/sharing/preview-card";
import { resolveTheme } from "@/themes/resolve";
import { readRendition } from "@/uploads/files";
import { findEventUpload } from "@/uploads/repository";
import { themeUpload } from "@/uploads/uploads";

// A crawler brings no language of its own, so the card is written in the source one.
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

  // A host's upload is drawn from its own rendition at the card's size: as itself where the page
  // shows it, and blurred as the page blurs it under Soft blur.
  const upload = await findEventUpload(event.id);
  const theme = resolveTheme(event.theme, upload ? themeUpload(upload) : null);
  const softBlur = theme.background.id === "upload-blur";
  const drawn = theme.upload ?? (softBlur ? upload : null);
  const card = drawn && (await readRendition(drawn.id, "card"));
  const picture = card ? `data:image/jpeg;base64,${Buffer.from(softBlur ? await blurredForCard(card) : card).toString("base64")}` : undefined;

  const png = await drawPreviewCard(event, theme, formatWhen(event, CARD_LOCALE), picture);
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": versioned ? "public, max-age=31536000, immutable" : "public, max-age=300",
    },
  });
}
