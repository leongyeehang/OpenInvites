import { crc32, deflateSync } from "node:zlib";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { processUpload } from "./process";

// A photo as a phone takes it: shot sideways (EXIF orientation 6, "rotate 90 degrees to show"),
// tagged with the camera and where it was taken.
async function phonePhoto() {
  return sharp({ create: { width: 400, height: 200, channels: 3, background: "#d9c7a3" } })
    .jpeg()
    .withExif({
      IFD0: { Make: "PhoneCo", Model: "Pocket 12" },
      IFD3: { GPSLatitudeRef: "N", GPSLatitude: "1/1 17/1 30/1", GPSLongitudeRef: "E", GPSLongitude: "103/1 51/1 12/1" },
    })
    .withMetadata({ orientation: 6 })
    .toBuffer();
}

async function processed(input: Buffer) {
  const result = await processUpload(new Uint8Array(input));
  if (!result.ok) throw new Error(`refused: ${result.problem}`);
  return result.picture;
}

// A dark picture at a screen's proportions with a white shape on it.
function darkWithWhite(shape: { left: number; top: number; width: number; height: number }) {
  return sharp({ create: { width: 1920, height: 1080, channels: 3, background: "#000000" } })
    .composite([{ input: { create: { width: shape.width, height: shape.height, channels: 3, background: "#ffffff" } }, left: shape.left, top: shape.top }])
    .png()
    .toBuffer();
}

describe("processing an upload", () => {
  it("keeps nothing of the photo's metadata, its location included, and stands it upright first", async () => {
    const photo = await phonePhoto();
    const before = await sharp(photo).metadata();
    expect(before.exif?.includes("PhoneCo")).toBe(true);
    expect(before.orientation).toBe(6);

    const { renditions } = await processed(photo);
    for (const [name, file] of Object.entries(renditions)) {
      const after = await sharp(file).metadata();
      expect(after.exif, name).toBeUndefined();
      expect(after.xmp, name).toBeUndefined();
      expect(after.iptc, name).toBeUndefined();
      expect(after.orientation, name).toBeUndefined();
      expect(Buffer.from(file).includes("PhoneCo"), name).toBe(false);
    }
    // Shot sideways, it is shown upright: taller than wide.
    expect(await sharp(renditions.background).metadata()).toMatchObject({ format: "webp", width: 200, height: 400 });
  });

  it("makes a large background, never enlarged, and a card at the card's size", async () => {
    const big = await processed(await sharp({ create: { width: 3000, height: 2000, channels: 3, background: "#1d2340" } }).png().toBuffer());
    expect(await sharp(big.renditions.background).metadata()).toMatchObject({ format: "webp", width: 2048, height: 1365 });
    expect(await sharp(big.renditions.card).metadata()).toMatchObject({ format: "jpeg", width: 1200, height: 630 });

    const small = await processed(await sharp({ create: { width: 800, height: 600, channels: 3, background: "#1d2340" } }).jpeg().toBuffer());
    expect(await sharp(small.renditions.background).metadata()).toMatchObject({ width: 800, height: 600 });
    expect(await sharp(small.renditions.card).metadata()).toMatchObject({ width: 1200, height: 630 });
  });

  it("makes a poster at the picture's own proportions, sharp on a high-density screen and never enlarged", async () => {
    const sizes: [picture: [number, number], poster: [number, number]][] = [
      [[3000, 2000], [1200, 800]],
      [[2000, 3000], [1200, 1800]],
      // Taller than twice its width, it stops at the poster's greatest height.
      [[1000, 4000], [600, 2400]],
      [[800, 600], [800, 600]],
    ];
    for (const [[width, height], [posterWidth, posterHeight]] of sizes) {
      const picture = await processed(await sharp({ create: { width, height, channels: 3, background: "#1d2340" } }).png().toBuffer());
      expect(await sharp(picture.renditions.poster).metadata(), `${width}x${height}`).toMatchObject({ format: "webp", width: posterWidth, height: posterHeight });
      // The page is told its size, so the poster has its place before it arrives.
      expect(picture.sample, `${width}x${height}`).toMatchObject({ posterWidth, posterHeight });
    }
  });

  it("paints a transparent picture onto white, the page it was most likely made on", async () => {
    const logo = await sharp({ create: { width: 100, height: 100, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
    const { renditions, sample } = await processed(logo);
    const { data, info } = await sharp(renditions.background).raw().toBuffer({ resolveWithObject: true });
    expect(info.channels).toBe(3);
    for (const channel of data.subarray(0, 3)) expect(channel).toBeGreaterThanOrEqual(250);
    expect(sample.luminance).toBeCloseTo(1, 2);
  });

  it("samples the picture's luminance and accent for the theme", async () => {
    const pale = await processed(await sharp({ create: { width: 600, height: 400, channels: 3, background: "#f3ead8" } }).jpeg().toBuffer());
    expect(pale.sample.luminance).toBeGreaterThan(0.6);
    expect(pale.sample.accent).toMatch(/^#[0-9a-f]{6}$/);
    const night = await processed(await sharp({ create: { width: 600, height: 400, channels: 3, background: "#1d2340" } }).jpeg().toBuffer());
    expect(night.sample.luminance).toBeLessThan(0.6);
  });

  it("measures the backdrop as the glass's blur sees it: a wide bright area in full, a small bright spot softened", async () => {
    const wide = await processed(await darkWithWhite({ left: 0, top: 0, width: 960, height: 1080 }));
    // White under the light tone's scrim, as bright as a backdrop can be.
    expect(wide.sample.lightest).toBe("#bfbfbf");
    const spot = await processed(await darkWithWhite({ left: 956, top: 536, width: 8, height: 8 }));
    // An 8-pixel star under a 24-pixel blur is a faint glow.
    expect(parseInt(spot.sample.lightest.slice(1, 3), 16)).toBeLessThan(40);
    expect(spot.sample.darkest).toBe("#404040");
  });

  it("measures the blurred copy behind a poster under its own heavier blur and stronger scrim", async () => {
    const wide = await processed(await darkWithWhite({ left: 0, top: 0, width: 960, height: 1080 }));
    // White under 45% black, and black under 45% white.
    expect(wide.sample).toMatchObject({ posterLightest: "#8c8c8c", posterDarkest: "#737373" });
    // A white patch the glass's blur leaves nearly white, the copy's 64-pixel blur spreads thin:
    // well under the 140 a wide white area measures there.
    const patch = await processed(await darkWithWhite({ left: 900, top: 480, width: 120, height: 120 }));
    const channel = (hex: string) => parseInt(hex.slice(1, 3), 16);
    expect(channel(patch.sample.lightest)).toBeGreaterThan(170);
    expect(channel(patch.sample.posterLightest)).toBeLessThan(110);
  });

  it("refuses a file that only starts like a picture", async () => {
    const fake = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new TextEncoder().encode("not really a JPEG at all")]);
    expect(await processUpload(fake)).toEqual({ ok: false, problem: "unsupported" });
    expect(await processUpload(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toEqual({ ok: false, problem: "unsupported" });
  });

  it("refuses a small file that claims a picture too big to decode, before decoding it", async () => {
    expect(await processUpload(pngClaiming(100_000, 100_000))).toEqual({ ok: false, problem: "tooManyPixels" });
  });
});

// A 68-byte PNG that says it is `width` by `height`: its signature, its header, a scrap of
// pixel data and its end. A reader believes the header until it decodes.
function pngClaiming(width: number, height: number): Uint8Array {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8 bits per channel, RGB, no interlace
  const chunk = (type: string, data: Buffer) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type), data])));
    return Buffer.concat([length, Buffer.from(type), data, crc]);
  };
  return new Uint8Array(
    Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", header), chunk("IDAT", deflateSync(Buffer.alloc(16))), chunk("IEND", Buffer.alloc(0))]),
  );
}
