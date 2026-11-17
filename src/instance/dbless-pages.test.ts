import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// The pages drawn without the database (M8 spec, "Testing Decisions"; the glass part's review): not
// found, too fast and the legal pages wear the fallback area's poster from DBLESS_POOL, so that a
// page shown when something has failed costs no query that may fail too. They hold to it only while
// nothing they import reaches the database, which this follows by reading: every file each page
// imports, and every file those import in turn, as far as the source goes, loaded at once or by a
// dynamic import() (src/instrumentation.ts loads that way). Type-only imports are left out, as
// nothing of them runs.

const ROOT = fileURLToPath(new URL("../..", import.meta.url));

const PAGES = ["src/app/not-found.tsx", "src/app/too-fast/page.tsx", "src/components/too-fast.tsx", "src/legal/legal-page.tsx"];

// What reaches the database: its client and schema, and the site's settings read from it.
const DATABASE = /^src\/(db\/|instance\/repository\.ts$)/;

const IMPORT = /^\s*(?:import|export)\s+(?!type\b)(?:[^"';]*?\sfrom\s+)?["']([^"']+)["']/gm;
// A dynamic import() of a module named outright; `typeof import("…")` names a type, not a load.
const DYNAMIC = /(?<!\btypeof\s+)\bimport\(\s*["']([^"']+)["']\s*\)/g;

// The modules a file's source names to load, at once or dynamically.
function importsOf(code: string): string[] {
  return [...code.matchAll(IMPORT), ...code.matchAll(DYNAMIC)].map(([, source]) => source);
}

// The file an import names, when it is one of the app's own: by the alias, or relative.
function resolve(from: string, source: string): string | null {
  const base = source.startsWith("@/") ? join(ROOT, "src", source.slice(2)) : source.startsWith(".") ? join(dirname(from), source) : null;
  if (!base) return null;
  return [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")].find((path) => existsSync(path) && /\.tsx?$/.test(path)) ?? null;
}

// Every file of the app's own that `entry` reaches, and by which path of imports.
function reached(entry: string): Map<string, string[]> {
  const paths = new Map<string, string[]>([[relative(ROOT, join(ROOT, entry)), [entry]]]);
  const queue = [join(ROOT, entry)];
  while (queue.length > 0) {
    const file = queue.shift()!;
    const via = paths.get(relative(ROOT, file))!;
    for (const source of importsOf(readFileSync(file, "utf8"))) {
      const found = resolve(file, source);
      if (!found || paths.has(relative(ROOT, found))) continue;
      paths.set(relative(ROOT, found), [...via, relative(ROOT, found)]);
      queue.push(found);
    }
  }
  return paths;
}

describe("the pages drawn without the database", () => {
  it("follows imports by the alias, relative and re-exported, and leaves type-only ones out", () => {
    const sources = (code: string) => [...code.matchAll(IMPORT)].map(([, source]) => source);
    expect(sources('import { a } from "@/x";\nimport b from "./y";\nexport { c } from "../z";\nimport "./side";\n')).toEqual(["@/x", "./y", "../z", "./side"]);
    expect(sources('import type { a } from "@/instance/repository";\nexport type { b } from "@/db/schema";\n')).toEqual([]);
    expect(sources('import {\n  a,\n  b,\n} from "@/instance/repository";\n')).toEqual(["@/instance/repository"]);
  });

  it("follows a dynamic import(), and leaves one in a type out", () => {
    expect(importsOf('const { a } = await import("@/x");\nawait import(\n  "./y"\n);\n')).toEqual(["@/x", "./y"]);
    expect(importsOf('type Schema = typeof import("@/db/schema");\n')).toEqual([]);
  });

  it("reach the site look and the themes, as they are drawn from them", () => {
    const files = [...reached("src/app/not-found.tsx").keys()];
    expect(files).toContain("src/instance/site-look.ts");
    expect(files).toContain("src/themes/site-page.tsx");
    expect(files).toContain("src/themes/legibility.ts");
  });

  for (const page of PAGES) {
    it(`${page} reaches nothing that reads the database`, () => {
      const database = [...reached(page)].filter(([file]) => DATABASE.test(file)).map(([, via]) => via.join(" → "));
      expect(database).toEqual([]);
    });
  }
});
