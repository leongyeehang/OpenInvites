import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BACKGROUNDS } from "./backgrounds";
import { TITLE_FONT_CLASSES, TITLE_FONT_FILES } from "./title-fonts";
import type { FontKey } from "./theme";

// Ticket 20: the title fonts and the curated scenes are served from public/, and a browser keeps
// them for a year without asking again (next.config.ts). That is right only while what is behind a
// name never changes, so each file is named after its content: the first eight hex digits of its
// SHA-256 before the extension. A file whose bytes change must take a new name, and this says which.
// And the page preloads a title font by the name title-fonts.ts gives it, while its @font-face in
// globals.css names the file the browser fetches: the two must be the same, or it fetches twice.

const PUBLIC = fileURLToPath(new URL("../../public", import.meta.url));
const CSS = readFileSync(fileURLToPath(new URL("../app/globals.css", import.meta.url)), "utf8");

const hashOf = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex").slice(0, 8);

describe("the fonts and scenes served from public/", () => {
  it("are named after their content, so a year's caching never shows an old one", () => {
    for (const folder of ["fonts", "backgrounds"]) {
      const files = readdirSync(join(PUBLIC, folder)).filter((file) => /\.(woff2|svg)$/.test(file));
      expect(files.length, folder).toBeGreaterThan(0);
      for (const file of files) {
        const named = file.replace(/^(.+?)(\.[0-9a-f]{8})?\.(woff2|svg)$/, `$1.${hashOf(join(PUBLIC, folder, file))}.$3`);
        expect(file, `public/${folder}/${file} should be named`).toBe(named);
      }
    }
  });

  it("are the files the code names", () => {
    for (const background of BACKGROUNDS) {
      if (background.kind === "photo") expect(existsSync(join(PUBLIC, background.src)), background.src).toBe(true);
    }
    for (const file of Object.values(TITLE_FONT_FILES)) expect(existsSync(join(PUBLIC, file)), file).toBe(true);
  });
});

describe("each title font", () => {
  // The @font-face rules in globals.css: the family, whether italic, and the file each names.
  const faces = [...CSS.matchAll(/@font-face\s*\{([^}]*)\}/g)].map(([, rule]) => ({
    family: rule.match(/font-family:\s*"([^"]+)"/)?.[1],
    italic: /font-style:\s*italic/.test(rule),
    file: rule.match(/url\("([^"]+)"\)/)?.[1],
  }));

  it("is preloaded as the file its class's face is fetched from", () => {
    const keys = Object.keys(TITLE_FONT_CLASSES) as FontKey[];
    expect(keys).toHaveLength(4);
    for (const key of keys) {
      const family = CSS.match(new RegExp(`\\.${TITLE_FONT_CLASSES[key]}\\s*\\{\\s*--theme-title-font:\\s*"([^"]+)"`))?.[1];
      expect(family, `the family .${TITLE_FONT_CLASSES[key]} names`).toBeDefined();
      const face = faces.find((candidate) => candidate.family === family && !candidate.italic && candidate.file);
      expect(face?.file, key).toBe(TITLE_FONT_FILES[key]);
    }
  });

  it("has every face's file there", () => {
    const files = faces.flatMap(({ file }) => (file ? [file] : []));
    expect(files.length).toBeGreaterThanOrEqual(5);
    for (const file of files) expect(existsSync(join(PUBLIC, file)), file).toBe(true);
  });
});
