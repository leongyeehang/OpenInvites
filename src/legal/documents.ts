import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { renderMarkdown } from "./markdown";
import { PLACEHOLDERS } from "./placeholders";
import { legalSource, type LegalPage } from "./source";

export const LEGAL_PAGES: LegalPage[] = ["privacy", "terms"];

// A legal page's text as HTML, from wherever the operator put it (source.ts). A mounted file is
// read on every request, so an edit to it shows without a restart.
export async function legalPageHtml(page: LegalPage): Promise<string> {
  const source = legalSource(process.env, page);
  if (source.from === "environment") return renderMarkdown(source.markdown);
  if (source.from === "file") return renderMarkdown(await readFile(source.path, "utf8"));
  return renderMarkdown(PLACEHOLDERS[page]);
}

// At start: each page's settings make sense, and a file named is there to be read, so a wrong
// path stops the app instead of breaking the page later.
export function checkLegalPagesAtStart(): void {
  for (const page of LEGAL_PAGES) {
    const source = legalSource(process.env, page);
    if (source.from !== "file") continue;
    try {
      readFileSync(source.path, "utf8");
    } catch (error) {
      throw new Error(`The ${page === "privacy" ? "privacy policy" : "terms of use"} file cannot be read: ${(error as Error).message}`);
    }
  }
}
