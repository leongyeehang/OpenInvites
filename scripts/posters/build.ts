import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { expect, test } from "@playwright/test";
import { processUpload } from "../../src/uploads/process";
import { ART } from "./art";
import { H, W } from "./svg";

// `pnpm posters`: builds the gallery posters (M4 spec, "The poster replaces the background") from
// their drawings in art.ts, and measures them. For each poster it writes to public/posters/:
//
// - the SVG the page shows as the poster;
// - a JPEG of it at 1200x1500, for the link's preview card, since Satori, which draws the card,
//   does not read SVG backgrounds reliably;
// - the small copy the page blurs behind it, as uploads/process.ts makes for a host's upload.
//
// Each file is named after its content (src/themes/public-files.test.ts). The poster is drawn by
// Chromium, as a guest's browser draws it, and that drawing is measured by the code that measures
// a host's upload (uploads/process.ts): its average luminance, and the lightest and darkest points
// of its blurred copy as text on the page meets them. What it measured, and where the files are,
// goes to src/themes/poster-files.ts, which posters.ts reads. Files no poster names any more are
// removed. docs/contributing/posters.md says when to run it. It needs no app running.

const OUT = "public/posters";
const DATA = "src/themes/poster-files.ts";
// A poster stays small enough to arrive with the page.
const MAX_SVG_BYTES = 60 * 1024;

const hashOf = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex").slice(0, 8);

type Built = { id: string; src: string; card: string; copy: string; luminance: number; lightest: string; darkest: string; sampledAccent: string };

test("build and measure the gallery posters", async ({ page }) => {
  test.setTimeout(10 * 60_000);
  mkdirSync(OUT, { recursive: true });
  const written = new Set<string>();
  const write = (name: string, bytes: string | Uint8Array) => {
    writeFileSync(join(OUT, name), bytes);
    written.add(name);
    return `/posters/${name}`;
  };

  await page.setViewportSize({ width: W, height: H });
  const built: Built[] = [];
  for (const art of ART) {
    const svg = art.draw();
    expect(Buffer.byteLength(svg), `${art.id} is too large`).toBeLessThanOrEqual(MAX_SVG_BYTES);
    expect(svg, `${art.id} has text in it`).not.toMatch(/<text\b/);
    expect(svg, `${art.id} refers to something outside it`).not.toMatch(/(href|src)=|url\((?!#)|@import/);
    const src = write(`${art.file}.${hashOf(svg)}.svg`, svg);

    // Drawn as the page draws it: an image, at its own size.
    await page.setContent(`<body style="margin:0"><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}" width="${W}" height="${H}" style="display:block"></body>`);
    await page.locator("img").evaluate((image: HTMLImageElement) => image.decode());
    const drawn = await page.screenshot({ clip: { x: 0, y: 0, width: W, height: H } });

    const jpeg = await sharp(drawn).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
    const card = write(`${art.file}.${hashOf(jpeg)}.jpg`, jpeg);

    const processed = await processUpload(drawn);
    if (!processed.ok) throw new Error(`${art.id}: ${processed.problem}`);
    const { renditions, sample } = processed.picture;
    const copy = write(`${art.file}-copy.${hashOf(renditions.posterCopy)}.webp`, renditions.posterCopy);

    built.push({
      id: art.id,
      src,
      card,
      copy,
      luminance: Math.round(sample.luminance * 100) / 100,
      lightest: sample.posterLightest,
      darkest: sample.posterDarkest,
      sampledAccent: sample.accent,
    });
    console.log(`${art.id}: ${(Buffer.byteLength(svg) / 1024).toFixed(1)} KB, luminance ${sample.luminance.toFixed(2)}, sampled accent ${sample.accent}`);
  }

  for (const file of readdirSync(OUT)) if (file !== "README.md" && !written.has(file)) rmSync(join(OUT, file));

  const entries = built
    .map(
      ({ id, src, card, copy, luminance, lightest, darkest }) =>
        `  ${JSON.stringify(id)}: { src: ${JSON.stringify(src)}, card: ${JSON.stringify(card)}, copy: ${JSON.stringify(copy)}, luminance: ${luminance}, lightest: ${JSON.stringify(lightest)}, darkest: ${JSON.stringify(darkest)} },`,
    )
    .join("\n");
  writeFileSync(
    DATA,
    `// Written by \`pnpm posters\` (scripts/posters/build.ts): do not edit by hand. For each gallery
// poster, its files in public/posters/ (the poster, its JPEG for the preview card, and the small
// copy the page blurs behind it) and what was measured from it: its average luminance, and the
// lightest and darkest points of its blurred copy as text on the page meets them, measured as a
// host's upload is (uploads/process.ts).

export type PosterFiles = { src: string; card: string; copy: string; luminance: number; lightest: string; darkest: string };

export const POSTER_FILES: Record<string, PosterFiles> = {
${entries}
};
`,
  );
});
