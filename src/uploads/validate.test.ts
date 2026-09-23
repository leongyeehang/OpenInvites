import { describe, expect, it } from "vitest";
import { ALT_TEXT_MAX, imageTypeOf, MAX_PIXELS, parseAltText, pixelProblem, uploadProblem } from "./validate";

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(parts.flatMap((part) => (typeof part === "string" ? [...part].map((char) => char.charCodeAt(0)) : part)));

// The first bytes of each kind of file, as the formats define them.
const JPEG = bytes([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10], "JFIF");
const PNG = bytes([0x89], "PNG", [0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d], "IHDR");
const WEBP = bytes("RIFF", [0x24, 0x00, 0x00, 0x00], "WEBPVP8 ");
// An ISO media file names its brands in its first box: the major one, a version, the compatible ones.
const isoFile = (major: string, ...compatible: string[]) => {
  const size = 16 + 4 * compatible.length;
  return bytes([0, 0, 0, size], "ftyp", major, [0, 0, 0, 0], compatible.join(""), "....mdat");
};

describe("the kind of picture a file is", () => {
  it("is read from the file's own first bytes", () => {
    expect(imageTypeOf(JPEG)).toBe("jpeg");
    expect(imageTypeOf(PNG)).toBe("png");
    expect(imageTypeOf(WEBP)).toBe("webp");
    expect(imageTypeOf(isoFile("avif", "mif1", "miaf"))).toBe("avif");
    // An AVIF may name a general brand first and AVIF among the compatible ones.
    expect(imageTypeOf(isoFile("mif1", "avif", "miaf"))).toBe("avif");
  });

  it("is none of them for anything else, whatever its name or claimed type", () => {
    const others = {
      empty: bytes(),
      text: bytes("Hello, this is not a picture"),
      svg: bytes('<svg xmlns="http://www.w3.org/2000/svg"/>'),
      gif: bytes("GIF89a", [1, 0, 1, 0]),
      pdf: bytes("%PDF-1.7"),
      // An iPhone's HEIC: the same container as AVIF, but a codec the server cannot decode.
      heic: isoFile("heic", "mif1", "heic"),
      // A video in the same container.
      mp4: isoFile("isom", "iso2", "mp41"),
      // A RIFF file that is not WebP, and a JPEG cut short.
      wav: bytes("RIFF", [0x24, 0, 0, 0], "WAVEfmt "),
      truncated: bytes([0xff, 0xd8]),
    };
    for (const [name, file] of Object.entries(others)) expect(imageTypeOf(file), name).toBeUndefined();
  });

  it("does not read past the end of a short container header", () => {
    expect(imageTypeOf(bytes([0, 0, 0, 64], "ftypmif1"))).toBeUndefined();
  });
});

describe("what is wrong with an upload", () => {
  const max = 10 * 1024 * 1024;
  const picture = (size: number) => {
    const file = new Uint8Array(size);
    file.set(JPEG);
    return file;
  };

  it("is nothing for a picture within the limit", () => {
    expect(uploadProblem(picture(1024), max)).toBeUndefined();
    expect(uploadProblem(picture(max), max)).toBeUndefined();
  });

  it("is its size when it is over the operator's limit, by even a byte", () => {
    expect(uploadProblem(picture(max + 1), max)).toBe("tooLarge");
  });

  it("is its kind when it is not a picture the server takes", () => {
    expect(uploadProblem(bytes("not a picture at all"), max)).toBe("unsupported");
  });
});

describe("a picture's pixels", () => {
  it("are fine up to the limit, which a 48-megapixel phone photo is under", () => {
    expect(pixelProblem({ width: 8064, height: 6048 })).toBeUndefined();
    expect(pixelProblem({ width: MAX_PIXELS, height: 1 })).toBeUndefined();
  });

  it("are too many past it, however few bytes they came in", () => {
    expect(pixelProblem({ width: MAX_PIXELS + 1, height: 1 })).toBe("tooManyPixels");
    // A file of a few kilobytes can claim to be 100,000 pixels square.
    expect(pixelProblem({ width: 100_000, height: 100_000 })).toBe("tooManyPixels");
  });
});

describe("the host's description of their picture", () => {
  it("is kept as written, without the space around it", () => {
    expect(parseAltText("  The garden at dusk, strung with fairy lights  ")).toBe("The garden at dusk, strung with fairy lights");
  });

  it("may be empty, when the picture is only decoration", () => {
    expect(parseAltText("")).toBe("");
    expect(parseAltText("   ")).toBe("");
  });

  it("is refused when it is not text or runs past the limit", () => {
    expect(parseAltText(undefined)).toBeUndefined();
    expect(parseAltText(42)).toBeUndefined();
    expect(parseAltText("a".repeat(ALT_TEXT_MAX))).toHaveLength(ALT_TEXT_MAX);
    expect(parseAltText("a".repeat(ALT_TEXT_MAX + 1))).toBeUndefined();
  });
});
