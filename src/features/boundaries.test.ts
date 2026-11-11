import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

// The rules that keep features apart (ADR-0008): nothing outside a module imports its other files,
// which the lint rule in eslint.config.mjs enforces for the new folders, and the album's outside
// dependents, which ADR-0008 counts, do not grow.

const ROOT = fileURLToPath(new URL("../..", import.meta.url));

// How many files outside src/album import its internals on 2026-11-11, as ADR-0008 records. A
// change that must add one moves the code into src/album instead, or raises this with a ruling
// recorded in the ADR as well.
const ALBUM_DEPENDENTS = 25;
const IMPORTS_ALBUM = /["'](@|\.\.?)\/(\.\.\/)*album\//;

describe("the module boundaries", () => {
  const eslint = new ESLint({ cwd: ROOT });
  const restricted = async (code: string, file: string) => {
    const [result] = await eslint.lintText(code, { filePath: join(ROOT, file) });
    return result.messages.some((message) => message.ruleId === "no-restricted-imports");
  };

  it("lets the rest of the app import a module through its entry only, and a module its own files", async () => {
    expect(await restricted('import { x } from "@/voting/rules";\nexport { x };\n', "src/app/x.ts")).toBe(true);
    expect(await restricted('import { x } from "@/voting";\nexport { x };\n', "src/app/x.ts")).toBe(false);
    expect(await restricted('import { x } from "../features/repository";\nexport { x };\n', "src/album/x.ts")).toBe(true);
    expect(await restricted('import { x } from "@/voting/rules";\nexport { x };\n', "src/voting/x.ts")).toBe(false);
    expect(await restricted('import { x } from "@/features/features";\nexport { x };\n', "src/voting/x.ts")).toBe(true);
  }, 60_000);

  it("keeps the album's outside dependents at the number ADR-0008 records", () => {
    const sources = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) return sources(path);
        return /\.tsx?$/.test(entry.name) ? [path] : [];
      });
    const dependents = sources(join(ROOT, "src"))
      .filter((path) => !relative(ROOT, path).startsWith(join("src", "album") + "/"))
      .filter((path) => IMPORTS_ALBUM.test(readFileSync(path, "utf8")));
    expect(dependents.length).toBeLessThanOrEqual(ALBUM_DEPENDENTS);
  });
});
