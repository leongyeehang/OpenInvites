// What the server takes as a host's picture (spec, "Uploads and images"). Everything here is
// judged from the file's own bytes: the name it came with and the type the browser claimed for
// it are the sender's word, not the file's.

// The kinds of picture a host can upload: what phones, cameras and design tools produce, and
// what the server's image library decodes. An iPhone's HEIC is not among them (the library
// ships without that codec), but Safari sends the photo as a JPEG to a page that does not ask
// for HEIC.
export const UPLOAD_TYPES = ["jpeg", "png", "webp", "avif"] as const;
export type UploadType = (typeof UPLOAD_TYPES)[number];

// Decoding a picture takes memory for every pixel, and a small file can claim a vast picture.
// 50 megapixels is above any phone's photo (48 at most) and far below what would exhaust a
// small instance.
export const MAX_PIXELS = 50_000_000;

// A description is a sentence or two; screen readers read it whole, so it should stay short.
export const ALT_TEXT_MAX = 300;

// What an upload can be refused for, each of which the drawer explains.
export const UPLOAD_PROBLEMS = ["tooLarge", "unsupported", "tooManyPixels"] as const;
export type UploadProblem = (typeof UPLOAD_PROBLEMS)[number];

const startsWith = (bytes: Uint8Array, signature: readonly number[], at = 0) =>
  bytes.length >= at + signature.length && signature.every((byte, index) => bytes[at + index] === byte);

const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));
const text = (bytes: Uint8Array, from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));

// The kind of picture a file is, from the signature every one of these formats starts with.
export function imageTypeOf(bytes: Uint8Array): UploadType | undefined {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(bytes, [0x89, ...ascii("PNG"), 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(bytes, ascii("RIFF")) && startsWith(bytes, ascii("WEBP"), 8)) return "webp";
  if (startsWith(bytes, ascii("ftyp"), 4)) {
    // An ISO media file's first box lists its brands: the major one at 8, then after a version
    // number the compatible ones, four bytes each, to the end of the box.
    const end = Math.min(new DataView(bytes.buffer, bytes.byteOffset).getUint32(0), bytes.length);
    const brands = [text(bytes, 8, 12)];
    for (let at = 16; at + 4 <= end; at += 4) brands.push(text(bytes, at, at + 4));
    if (brands.includes("avif") || brands.includes("avis")) return "avif";
  }
  return undefined;
}

// What is wrong with a file sent as a picture, before it is decoded at all.
export function uploadProblem(bytes: Uint8Array, maxBytes: number): UploadProblem | undefined {
  if (bytes.byteLength > maxBytes) return "tooLarge";
  if (!imageTypeOf(bytes)) return "unsupported";
  return undefined;
}

// Read from the picture's header, before any pixel is decoded.
export function pixelProblem({ width, height }: { width: number; height: number }): "tooManyPixels" | undefined {
  return width * height > MAX_PIXELS ? "tooManyPixels" : undefined;
}

// The alternative text the host gives their picture. Empty means the picture is decoration.
export function parseAltText(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const altText = raw.trim();
  return altText.length <= ALT_TEXT_MAX ? altText : undefined;
}
