import { describe, expect, it } from "vitest";
import { keepsMotion, MOTION_MAX_BYTES, motionRange, readXmp, seesLivePhotoNote } from "./motion";

// Live photos (M8 ticket 08): where an Android motion photo keeps its clip, whether the site keeps
// motion, and who is told what becomes of an iPhone's Live Photo. Every offset and length is the
// uploader's own, so the crafted cases matter as much as the real ones: a file that cannot be read
// is a still, never an error.

const ascii = (text: string) => new TextEncoder().encode(text);
const join = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
};

const XMP_PREFIX = ascii("http://ns.adobe.com/xap/1.0/\0");

// A minimal JPEG: SOI, an APP1 XMP segment when given, EOI.
function jpeg(xmp?: string): Uint8Array {
  if (xmp === undefined) return Uint8Array.of(0xff, 0xd8, 0xff, 0xd9);
  const body = join(XMP_PREFIX, ascii(xmp));
  const length = body.length + 2;
  return join(Uint8Array.of(0xff, 0xd8, 0xff, 0xe1, length >> 8, length & 0xff), body, Uint8Array.of(0xff, 0xd9));
}

// A fake MP4: a box header naming `ftyp`, then bytes.
const mp4 = (more = 40) => join(Uint8Array.of(0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32), new Uint8Array(more).fill(7));

const CLIP = mp4();

const attributes = (length: number | string, motion = "1") => `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about="" xmlns:GCamera="http://ns.google.com/photos/1.0/camera/" xmlns:Container="http://ns.google.com/photos/1.0/container/" xmlns:Item="http://ns.google.com/photos/1.0/container/item/"
    GCamera:MotionPhoto="${motion}" GCamera:MotionPhotoVersion="1" GCamera:MotionPhotoPresentationTimestampUs="1000000">
    <Container:Directory><rdf:Seq>
      <rdf:li rdf:parseType="Resource"><Container:Item Item:Mime="image/jpeg" Item:Semantic="Primary" Item:Length="0" Item:Padding="0"/></rdf:li>
      <rdf:li rdf:parseType="Resource"><Container:Item Item:Mime="video/mp4" Item:Semantic="MotionPhoto" Item:Length="${length}" Item:Padding="0"/></rdf:li>
    </rdf:Seq></Container:Directory>
  </rdf:Description></rdf:RDF></x:xmpmeta>`;

const elements = (length: number) => `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about="" xmlns:GCamera="http://ns.google.com/photos/1.0/camera/" xmlns:Container="http://ns.google.com/photos/1.0/container/" xmlns:Item="http://ns.google.com/photos/1.0/container/item/">
    <GCamera:MotionPhoto>1</GCamera:MotionPhoto>
    <GCamera:MotionPhotoVersion>1</GCamera:MotionPhotoVersion>
    <Container:Directory><rdf:Seq>
      <rdf:li rdf:parseType="Resource"><Container:Item rdf:parseType="Resource"><Item:Mime>image/jpeg</Item:Mime><Item:Semantic>Primary</Item:Semantic></Container:Item></rdf:li>
      <rdf:li rdf:parseType="Resource"><Container:Item rdf:parseType="Resource"><Item:Mime>video/mp4</Item:Mime><Item:Semantic>MotionPhoto</Item:Semantic><Item:Length>${length}</Item:Length></Container:Item></rdf:li>
    </rdf:Seq></Container:Directory>
  </rdf:Description></rdf:RDF></x:xmpmeta>`;

const microVideo = (offset: number | string) =>
  `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:GCamera="http://ns.google.com/photos/1.0/camera/" GCamera:MicroVideo="1" GCamera:MicroVideoVersion="1" GCamera:MicroVideoOffset="${offset}" GCamera:MicroVideoPresentationTimestampUs="1500000"/></rdf:RDF></x:xmpmeta>`;

// A Pixel's Ultra HDR motion photo: the still, its gain map, then the clip.
const threeItems = (gainMap: number, clip: number) => `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about="" xmlns:GCamera="http://ns.google.com/photos/1.0/camera/" xmlns:Container="http://ns.google.com/photos/1.0/container/" xmlns:Item="http://ns.google.com/photos/1.0/container/item/"
    GCamera:MotionPhoto="1" GCamera:MotionPhotoVersion="1">
    <Container:Directory><rdf:Seq>
      <rdf:li rdf:parseType="Resource"><Container:Item Item:Mime="image/jpeg" Item:Semantic="Primary" Item:Length="0" Item:Padding="0"/></rdf:li>
      <rdf:li rdf:parseType="Resource"><Container:Item Item:Mime="image/jpeg" Item:Semantic="GainMap" Item:Length="${gainMap}"/></rdf:li>
      <rdf:li rdf:parseType="Resource"><Container:Item Item:Mime="video/mp4" Item:Semantic="MotionPhoto" Item:Length="${clip}" Item:Padding="0"/></rdf:li>
    </rdf:Seq></Container:Directory>
  </rdf:Description></rdf:RDF></x:xmpmeta>`;

const SAMSUNG = ascii("MotionPhoto_Data");
const trailer = () => join(ascii("SEFH"), new Uint8Array(12).fill(1), ascii("SEFT"));

describe("motionRange", () => {
  it("finds the clip of Google's container, in attribute form and in element form", () => {
    for (const xmp of [attributes(CLIP.length), elements(CLIP.length)]) {
      const still = jpeg(xmp);
      const file = join(still, CLIP);
      expect(motionRange(file)).toEqual({ start: still.length, end: file.length });
    }
  });

  it("finds the older MicroVideo's clip by its offset from the end", () => {
    const file = join(jpeg(microVideo(CLIP.length)), CLIP);
    expect(motionRange(file)).toEqual({ start: file.length - CLIP.length, end: file.length });
  });

  it("finds Samsung's clip between its marker and the trailer, or the end", () => {
    const still = jpeg();
    const withTrailer = join(still, SAMSUNG, CLIP, trailer());
    expect(motionRange(withTrailer)).toEqual({ start: still.length + SAMSUNG.length, end: still.length + SAMSUNG.length + CLIP.length });
    const bare = join(still, SAMSUNG, CLIP);
    expect(motionRange(bare)).toEqual({ start: still.length + SAMSUNG.length, end: bare.length });
  });

  it("finds Samsung's marker past near misses, and its trailer only in the file's last 64 KB", () => {
    const still = jpeg();
    const misses = ascii("MotionPhoto_DatMotionPhotoMotionPhoto_DaMotionPhoto_Dat");
    const file = join(still, misses, SAMSUNG, CLIP, trailer());
    expect(motionRange(file)).toEqual({ start: still.length + misses.length + SAMSUNG.length, end: still.length + misses.length + SAMSUNG.length + CLIP.length });
    // A trailer header further from the end than that is not looked for: the clip runs to the end.
    const far = join(still, SAMSUNG, CLIP, ascii("SEFH"), new Uint8Array(70_000));
    expect(motionRange(far)).toEqual({ start: still.length + SAMSUNG.length, end: far.length });
  });

  it("finds a Pixel's Ultra HDR motion photo's clip, the last of three items, by its length from the end", () => {
    const gainMap = join(Uint8Array.of(0xff, 0xd8), new Uint8Array(60).fill(3), Uint8Array.of(0xff, 0xd9));
    const still = jpeg(threeItems(gainMap.length, CLIP.length));
    const file = join(still, gainMap, CLIP);
    expect(motionRange(file)).toEqual({ start: still.length + gainMap.length, end: file.length });
  });

  it("finds nothing in a plain JPEG, nor where the photo says it has no motion", () => {
    expect(motionRange(jpeg())).toBeUndefined();
    expect(motionRange(join(jpeg(attributes(CLIP.length, "0")), CLIP))).toBeUndefined();
    expect(motionRange(new Uint8Array(0))).toBeUndefined();
    expect(motionRange(Uint8Array.of(0x89, 0x50, 0x4e, 0x47))).toBeUndefined();
  });

  it("finds nothing for a length of 0, or one larger than the file", () => {
    expect(motionRange(join(jpeg(attributes(0)), CLIP))).toBeUndefined();
    const too = join(jpeg(attributes(100_000)), CLIP);
    expect(motionRange(too)).toBeUndefined();
    expect(motionRange(join(jpeg(attributes("99999999999999999999")), CLIP))).toBeUndefined();
    expect(motionRange(join(jpeg(attributes(-5)), CLIP))).toBeUndefined();
  });

  it("finds nothing where the range's bytes 4 to 8 are not ftyp", () => {
    const notMp4 = new Uint8Array(CLIP.length).fill(9);
    expect(motionRange(join(jpeg(attributes(notMp4.length)), notMp4))).toBeUndefined();
    expect(motionRange(join(jpeg(), SAMSUNG, notMp4))).toBeUndefined();
    // A length one short starts the range a byte late, where ftyp is not.
    expect(motionRange(join(jpeg(attributes(CLIP.length - 1)), CLIP))).toBeUndefined();
  });

  it("finds nothing for an offset past the end, a zero offset, or a clip too short to hold its box header", () => {
    expect(motionRange(join(jpeg(microVideo(10_000)), CLIP))).toBeUndefined();
    expect(motionRange(join(jpeg(microVideo(0)), CLIP))).toBeUndefined();
    expect(motionRange(join(jpeg(microVideo(6)), CLIP))).toBeUndefined();
    expect(motionRange(join(jpeg(microVideo("1e3")), CLIP))).toBeUndefined();
  });

  it("finds nothing for a clip over the limit", () => {
    const big = mp4(MOTION_MAX_BYTES);
    expect(motionRange(join(jpeg(attributes(big.length)), big))).toBeUndefined();
    expect(motionRange(join(jpeg(), SAMSUNG, big))).toBeUndefined();
    const most = mp4(MOTION_MAX_BYTES - 12);
    expect(motionRange(join(jpeg(attributes(most.length)), most))?.end).toBeDefined();
  });

  it("stops at a segment whose length is zero, runs past the end, or points back on itself", () => {
    const zero = join(Uint8Array.of(0xff, 0xd8, 0xff, 0xe1, 0x00, 0x00), XMP_PREFIX, ascii(attributes(CLIP.length)), CLIP);
    expect(motionRange(zero)).toBeUndefined();
    const one = join(Uint8Array.of(0xff, 0xd8, 0xff, 0xe1, 0x00, 0x01), CLIP);
    expect(motionRange(one)).toBeUndefined();
    const past = join(Uint8Array.of(0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff), XMP_PREFIX, ascii(attributes(CLIP.length)), CLIP);
    expect(motionRange(past)).toBeUndefined();
    // A run of fill bytes and a truncated header end the walk too.
    expect(motionRange(join(Uint8Array.of(0xff, 0xd8), new Uint8Array(5000).fill(0xff)))).toBeUndefined();
    expect(motionRange(Uint8Array.of(0xff, 0xd8, 0xff, 0xe1, 0x00))).toBeUndefined();
  });

  it("finds nothing in a directory of more items than any phone writes, nor for an item after the clip with no length", () => {
    const many = `<x:xmpmeta><rdf:Description GCamera:MotionPhoto="1"><Container:Directory>${'<Container:Item Item:Semantic="Primary" Item:Length="0"/>'.repeat(1000)}<Container:Item Item:Semantic="MotionPhoto" Item:Length="${CLIP.length}"/></Container:Directory></rdf:Description></x:xmpmeta>`;
    expect(motionRange(join(jpeg(many), CLIP))).toBeUndefined();
    const after = `<x:xmpmeta><rdf:Description GCamera:MotionPhoto="1"><Container:Directory><Container:Item Item:Semantic="Primary"/><Container:Item Item:Semantic="MotionPhoto" Item:Length="${CLIP.length}"/><Container:Item Item:Semantic="GainMap"/></Container:Directory></rdf:Description></x:xmpmeta>`;
    expect(motionRange(join(jpeg(after), CLIP))).toBeUndefined();
  });
});

// Review fixes: the XMP read is one segment at most, every scan of it is linear, and the cases the
// first round left out.
describe("motionRange, bounded", () => {
  // One APP1 XMP segment, as large as a segment can be (its length is two bytes), filled with `fill`.
  const fullSegment = (head: string, fill: string) => {
    const room = 0xffff - 2 - XMP_PREFIX.length - head.length;
    return segment(0xe1, join(XMP_PREFIX, ascii(head + fill.repeat(Math.ceil(room / fill.length)).slice(0, room))));
  };
  const segment = (marker: number, body: Uint8Array) => join(Uint8Array.of(0xff, marker, (body.length + 2) >> 8, (body.length + 2) & 0xff), body);
  const xmpSegment = (xmp: string) => segment(0xe1, join(XMP_PREFIX, ascii(xmp)));
  const SOI = Uint8Array.of(0xff, 0xd8);
  const EOI = Uint8Array.of(0xff, 0xd9);

  it("reads the first XMP packet alone, whatever follows it, so the text scanned is one segment at most", () => {
    const first = fullSegment('<x:xmpmeta GCamera:Other="1">', "a");
    const rest = Array.from({ length: 255 }, () => fullSegment(attributes(CLIP.length), " "));
    const file = join(SOI, first, ...rest, EOI, CLIP);
    const xmp = readXmp(file);
    expect(xmp?.length).toBe(0xffff - 2 - XMP_PREFIX.length);
    expect(xmp?.startsWith("<x:xmpmeta GCamera:Other")).toBe(true);
    // The later packets declare the clip; only the first is read, so the photo is a still.
    expect(motionRange(file)).toBeUndefined();
  });

  it("finds the clip the first packet declares, past many segments after it", () => {
    const file = join(SOI, xmpSegment(attributes(CLIP.length)), ...Array.from({ length: 200 }, () => fullSegment("", "z")), EOI, CLIP);
    expect(motionRange(file)).toEqual({ start: file.length - CLIP.length, end: file.length });
  });

  it("is a still for a packet of opening tags that never close, at the largest size read", () => {
    const head = '<x:xmpmeta><rdf:Description GCamera:MotionPhoto="1">';
    for (const fill of ["<Container:Directory", "<Container:Item ", 'Item:Length="', "<Item:Length>", "GCamera:MotionPhoto= "]) {
      expect(motionRange(join(SOI, fullSegment(head, fill), EOI, CLIP))).toBeUndefined();
    }
  });

  it("counts an item's padding after it, the clip's own and that of an item after it", () => {
    const padded = (clipPadding: number, after?: { length: number; padding: number }) =>
      `<x:xmpmeta><rdf:Description GCamera:MotionPhoto="1"><Container:Directory><Container:Item Item:Semantic="Primary" Item:Length="0" Item:Padding="7"/><Container:Item Item:Semantic="MotionPhoto" Item:Length="${CLIP.length}" Item:Padding="${clipPadding}"/>${after ? `<Container:Item Item:Semantic="Depth" Item:Length="${after.length}" Item:Padding="${after.padding}"/>` : ""}</Container:Directory></rdf:Description></x:xmpmeta>`;
    const still = jpeg(padded(5));
    const own = join(still, CLIP, new Uint8Array(5));
    expect(motionRange(own)).toEqual({ start: still.length, end: still.length + CLIP.length });
    const withAfter = jpeg(padded(3, { length: 20, padding: 2 }));
    const file = join(withAfter, CLIP, new Uint8Array(3), new Uint8Array(20).fill(4), new Uint8Array(2));
    expect(motionRange(file)).toEqual({ start: withAfter.length, end: withAfter.length + CLIP.length });
    // A padding that is not a whole number is a still.
    expect(motionRange(join(jpeg(padded(5).replace('Item:Padding="5"', 'Item:Padding="x"')), CLIP, new Uint8Array(5)))).toBeUndefined();
  });

  it("never takes a range starting at byte 0 or 1, even where ftyp sits there", () => {
    // A first segment whose length bytes and body put `ftyp` at bytes 4 to 8 (start 0) or 5 to 9
    // (start 1), then a MicroVideo offset reaching back to that start.
    const at = (start: number) => {
      const lead = start === 0 ? Uint8Array.of(0x66, 0x74, 0x79, 0x70) : Uint8Array.of(0x00, 0x66, 0x74, 0x79, 0x70);
      const length = (lead[0] << 8) | lead[1];
      const body = join(lead.subarray(2), new Uint8Array(length - lead.length).fill(0x20));
      const first = join(Uint8Array.of(0xff, 0xd8, 0xff, 0xe0), lead.subarray(0, 2), body.subarray(0, length - 2));
      // Eight digits either way, so the offset's own length does not move the end.
      const digits = (offset: number) => String(offset).padStart(8, "0");
      const total = join(first, xmpSegment(microVideo(digits(0))), EOI, CLIP).length;
      const file = join(first, xmpSegment(microVideo(digits(total - start))), EOI, CLIP);
      expect(file.length).toBe(total);
      return file;
    };
    for (const start of [0, 1]) {
      const file = at(start);
      expect(String.fromCharCode(...file.subarray(start + 4, start + 8))).toBe("ftyp");
      expect(motionRange(file)).toBeUndefined();
    }
  });
});

describe("keepsMotion", () => {
  it("is true only while the site's Videos feature is on and ffmpeg is usable", () => {
    expect(keepsMotion({ videosOn: true, ffmpegUsable: true })).toBe(true);
    expect(keepsMotion({ videosOn: false, ffmpegUsable: true })).toBe(false);
    expect(keepsMotion({ videosOn: true, ffmpegUsable: false })).toBe(false);
    expect(keepsMotion({ videosOn: false, ffmpegUsable: false })).toBe(false);
  });
});

describe("seesLivePhotoNote", () => {
  const IPHONE_SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
  const IPHONE_CHROME = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1";
  const IPAD = "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
  const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
  const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";

  it("is shown on an iPhone, in Safari or Chrome, and on an iPad, whichever agent it sends", () => {
    expect(seesLivePhotoNote(IPHONE_SAFARI, 5)).toBe(true);
    expect(seesLivePhotoNote(IPHONE_CHROME, 5)).toBe(true);
    expect(seesLivePhotoNote(IPAD, 5)).toBe(true);
    // An iPad's Safari asks for desktop pages as a Mac, which has no touch screen.
    expect(seesLivePhotoNote(MAC, 5)).toBe(true);
  });

  it("is not shown on a Mac or on Android", () => {
    expect(seesLivePhotoNote(MAC, 0)).toBe(false);
    expect(seesLivePhotoNote(ANDROID, 5)).toBe(false);
  });
});
