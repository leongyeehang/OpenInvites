import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { notFound } from "next/navigation";
import sharp from "sharp";
import { eventPageFor } from "@/events/access";
import { findEventBySlug } from "@/events/repository";
import { isSlug } from "@/events/slug";
import { formatWhen } from "@/events/time";
import { drawPreviewCard, PREVIEW_SIZE } from "@/sharing/preview-card";
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

  // A host's upload is drawn from its own rendition at the card's size, while it is the poster. A
  // gallery poster is drawn from its JPEG (Satori does not read its SVG reliably), cut to the card.
  const upload = await findEventUpload(event.id);
  const theme = resolveTheme(event.theme, upload ? themeUpload(upload) : null);
  const card = theme.upload
    ? await readRendition(theme.upload.id, "card")
    : theme.gallery &&
      (await sharp(await readFile(join(process.cwd(), "public", theme.gallery.card)))
        .resize(PREVIEW_SIZE.width, PREVIEW_SIZE.height, { fit: "cover" })
        .jpeg({ quality: 82 })
        .toBuffer());
  const picture = card ? `data:image/jpeg;base64,${Buffer.from(card).toString("base64")}` : undefined;

  const png = await drawPreviewCard(event, theme, formatWhen(event, CARD_LOCALE), picture);
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": versioned ? "public, max-age=31536000, immutable" : "public, max-age=300",
    },
  });
}
