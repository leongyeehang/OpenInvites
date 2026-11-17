// Live photos (M8 ticket 08; spec, "Live photos"): a photo that keeps a few seconds of motion. The
// motion comes from an Android motion photo, which carries its clip inside the JPEG, after the
// still: Google's container names it in the photo's XMP, the older MicroVideo by its offset from
// the end, and Samsung's after a marker of its own. Pure, and safe in the browser, which asks only
// whether to show the iPhone note.
//
// Every offset and length here is the uploader's own. Each is checked against the file before it
// is used, no loop runs longer than the file or a fixed bound, nothing over MOTION_MAX_BYTES is
// taken, and a file that cannot be read is simply a still. The text read is the first XMP packet
// alone, one segment of at most 64 KB, and every scan of it is linear: the finish runs this
// synchronously, so a crafted packet must not hold the server (ticket 08's review).

// At most a few seconds (plan ruling 15): about what a phone records around the shot; anything
// longer is cut.
export const MOTION_MAX_SECONDS = 3;

// Characters read for one property's value: a mime type, a semantic or a number fits many times.
const VALUE_MAX = 64;

// The largest clip taken out of a photo: far more than any phone's few seconds, so a range larger
// than this is a file that lies, and nothing of it is copied or handed to ffmpeg.
export const MOTION_MAX_BYTES = 32 * 1024 * 1024;

// The motion is kept while the site's Videos feature is on and ffmpeg is usable (plan ruling 15);
// an event's Allow videos does not stop it, since a live photo is a photo.
export function keepsMotion(site: { videosOn: boolean; ffmpegUsable: boolean }): boolean {
  return site.videosOn && site.ffmpegUsable;
}

// The iPhone note goes to iPhones and iPads only (plan ruling 16), Chrome's on an iPhone included,
// and to an iPad's Safari asking for desktop pages, which names itself a Mac with a touch screen.
export function seesLivePhotoNote(userAgent: string, maxTouchPoints: number): boolean {
  return /\b(iPhone|iPad|iPod)\b/.test(userAgent) || (/\bMacintosh\b/.test(userAgent) && maxTouchPoints > 1);
}

const encode = (text: string) => new TextEncoder().encode(text);
const XMP_PREFIX = encode("http://ns.adobe.com/xap/1.0/\0");
const SAMSUNG_MARKER = encode("MotionPhoto_Data");
const SAMSUNG_TRAILER = encode("SEFH");
const FTYP = encode("ftyp");

// More segments than any camera writes before the picture, and more items than any container
// holds: a file past either is read no further.
const MAX_SEGMENTS = 256;
const MAX_ITEMS = 16;

// Samsung's trailer is a short index of its blocks at the very end of the file; its header is
// looked for only this far from the end.
export const TRAILER_MAX_BYTES = 64 * 1024;

type Range = { start: number; end: number };

// Where the motion clip lies in a photo's bytes, or nothing for a still: Google's container or
// MicroVideo as the XMP before the first SOS says, then Samsung's marker; a range is taken only
// when it lies within the file, is no larger than MOTION_MAX_BYTES, and starts with an MP4's
// `ftyp` box.
export function motionRange(bytes: Uint8Array): Range | undefined {
  const headers = jpegHeaders(bytes);
  if (!headers) return undefined;
  return (headers.xmp !== undefined ? fromXmp(bytes, headers.xmp) : undefined) ?? fromSamsung(bytes, headers.end);
}

// The first XMP packet before the picture's data, the one text motionRange reads: one segment, so
// at most 65,533 bytes less the prefix, however many segments follow.
export function readXmp(bytes: Uint8Array): string | undefined {
  return jpegHeaders(bytes)?.xmp;
}

// The first XMP packet among a JPEG's APP1 segments before the first SOS (Google's container is in
// the main packet; an extended packet has a prefix of its own and is never read), and where the
// walk stopped; nothing for a file that is not a JPEG.
function jpegHeaders(bytes: Uint8Array): { xmp: string | undefined; end: number } | undefined {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return undefined;
  let xmp: string | undefined;
  let at = 2;
  for (let segment = 0; segment < MAX_SEGMENTS && at + 4 <= bytes.length && bytes[at] === 0xff; segment++) {
    const marker = bytes[at + 1];
    // A fill byte before a marker.
    if (marker === 0xff) {
      at += 1;
      continue;
    }
    // The picture's data (SOS), or the end of the picture (EOI).
    if (marker === 0xda || marker === 0xd9) break;
    // Markers that carry no length.
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      at += 2;
      continue;
    }
    const length = (bytes[at + 2] << 8) | bytes[at + 3];
    const end = at + 2 + length;
    if (length < 2 || end > bytes.length) break;
    if (xmp === undefined && marker === 0xe1 && startsWith(bytes, at + 4, XMP_PREFIX) && at + 4 + XMP_PREFIX.length <= end) {
      xmp = new TextDecoder().decode(bytes.subarray(at + 4 + XMP_PREFIX.length, end));
    }
    at = end;
  }
  return { xmp, end: at };
}

// Google's container: the clip is the directory's MotionPhoto item, and the items after the
// primary image lie at the end of the file in their order, so the clip is found by counting back
// from the end through the items after it (a Pixel's Ultra HDR photo puts a gain map before it).
// An item's padding follows it. The older MicroVideo names the clip's offset from the end.
function fromXmp(bytes: Uint8Array, xmp: string): Range | undefined {
  if (!xmp) return undefined;
  if (property(xmp, "GCamera:MotionPhoto") === "1") {
    const open = xmp.indexOf("<Container:Directory");
    const close = open < 0 ? -1 : xmp.indexOf("</Container:Directory>", open);
    const directory = open < 0 ? xmp : xmp.slice(open, close < 0 ? undefined : close);
    const chunks = directory.split(/<Container:Item\b/).slice(1);
    if (chunks.length > MAX_ITEMS) return undefined;
    const items = chunks.map((chunk) => ({ semantic: property(chunk, "Item:Semantic"), length: whole(property(chunk, "Item:Length")), padding: whole(property(chunk, "Item:Padding") ?? "0") }));
    const motion = items.findIndex((item) => item.semantic === "MotionPhoto");
    if (motion < 1) return undefined;
    let end = bytes.length;
    for (let at = items.length - 1; at >= motion; at--) {
      const { length, padding } = items[at];
      if (length === undefined || length <= 0 || padding === undefined) return undefined;
      end -= padding;
      if (at === motion) return checked(bytes, end - length, end);
      end -= length;
    }
    return undefined;
  }
  if (property(xmp, "GCamera:MicroVideo") === "1") {
    const offset = whole(property(xmp, "GCamera:MicroVideoOffset"));
    return offset === undefined ? undefined : checked(bytes, bytes.length - offset, bytes.length);
  }
  return undefined;
}

// Samsung's: the clip follows the marker, after the picture, and ends where the trailer's header
// begins, in the file's last TRAILER_MAX_BYTES, or at the end of the file when there is none. The
// marker is looked for only where a clip of at most MOTION_MAX_BYTES could follow it (M8 ticket 09):
// one further from the end would give a range `checked` refuses, so the search costs the same for
// a photo of any size, the operator's largest included.
function fromSamsung(bytes: Uint8Array, from: number): Range | undefined {
  const marker = indexOf(bytes, SAMSUNG_MARKER, Math.max(from, bytes.length - MOTION_MAX_BYTES - TRAILER_MAX_BYTES - SAMSUNG_MARKER.length));
  if (marker < 0) return undefined;
  const start = marker + SAMSUNG_MARKER.length;
  const trailer = lastIndexOf(bytes, SAMSUNG_TRAILER, Math.max(start, bytes.length - TRAILER_MAX_BYTES));
  return checked(bytes, start, trailer < 0 ? bytes.length : trailer);
}

// A range within the file, no larger than the limit, long enough for a box header, whose bytes 4
// to 8 are `ftyp`, as every MP4 begins.
function checked(bytes: Uint8Array, start: number, end: number): Range | undefined {
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) return undefined;
  if (start < 2 || end > bytes.length || end - start < 8 || end - start > MOTION_MAX_BYTES) return undefined;
  return startsWith(bytes, start + 4, FTYP) ? { start, end } : undefined;
}

// A property's value in either of XMP's forms: an attribute (`GCamera:MotionPhoto="1"`) or an
// element (`<GCamera:MotionPhoto>1</GCamera:MotionPhoto>`). Each place the name appears is read
// through a window of a few dozen characters after it, so the whole read is linear in the text,
// however its tags are left open; a value longer than VALUE_MAX is not one.
function property(text: string, name: string): string | undefined {
  const attribute = new RegExp(`^\\s{0,16}=\\s{0,16}(?:"([^"]{0,${VALUE_MAX}})"|'([^']{0,${VALUE_MAX}})')`);
  const element = new RegExp(`^>([^<]{0,${VALUE_MAX}})</${name}>`);
  for (let at = text.indexOf(name); at >= 0; at = text.indexOf(name, at + name.length)) {
    const before = at > 0 ? text[at - 1] : "";
    const window = text.slice(at + name.length, at + name.length + VALUE_MAX + name.length + 40);
    const match = before === "<" ? element.exec(window) : /[\w:/]/.test(before) ? null : attribute.exec(window);
    const value = match?.[1] ?? match?.[2];
    if (value !== undefined) return value.trim();
  }
  return undefined;
}

// A whole number written as digits, no more than a file's length could be; nothing otherwise.
function whole(text: string | undefined): number | undefined {
  return text !== undefined && /^\d{1,12}$/.test(text) ? Number(text) : undefined;
}

function startsWith(bytes: Uint8Array, at: number, pattern: Uint8Array): boolean {
  if (at < 0 || at + pattern.length > bytes.length) return false;
  for (let index = 0; index < pattern.length; index++) if (bytes[at + index] !== pattern[index]) return false;
  return true;
}

// The first place `pattern` starts at or after `from`, or -1: Horspool's search, which compares a
// window from its end and moves it by how far that last byte is from the pattern's end, so a long
// file, even one crafted of the pattern's own bytes, is crossed in a few steps a byte.
function indexOf(bytes: Uint8Array, pattern: Uint8Array, from: number): number {
  const last = pattern.length - 1;
  const shift = new Array<number>(256).fill(pattern.length);
  for (let index = 0; index < last; index++) shift[pattern[index]] = last - index;
  for (let at = Math.max(0, from); at + last < bytes.length; at += shift[bytes[at + last]]) {
    let index = last;
    while (index >= 0 && bytes[at + index] === pattern[index]) index--;
    if (index < 0) return at;
  }
  return -1;
}

// The last place `pattern` starts at or after `from`, or -1; the caller bounds how far back that is.
// Searched within the window alone, so no scan runs on past `from` towards the file's start.
function lastIndexOf(bytes: Uint8Array, pattern: Uint8Array, from: number): number {
  const start = Math.max(0, from);
  const window = bytes.subarray(start);
  for (let at = window.lastIndexOf(pattern[0]); at >= 0; at = at === 0 ? -1 : window.lastIndexOf(pattern[0], at - 1)) {
    if (startsWith(window, at, pattern)) return start + at;
  }
  return -1;
}
