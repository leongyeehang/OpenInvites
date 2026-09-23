// The instance's two legal pages (spec, "Operator configuration"): the privacy policy and the
// terms of use, each written by the operator in Markdown.
export type LegalPage = "privacy" | "terms";

export type LegalSource = { from: "environment"; markdown: string } | { from: "file"; path: string } | { from: "placeholder" };

const SETTINGS: Record<LegalPage, { file: string; markdown: string }> = {
  privacy: { file: "PRIVACY_POLICY_FILE", markdown: "PRIVACY_POLICY_MARKDOWN" },
  terms: { file: "TERMS_FILE", markdown: "TERMS_MARKDOWN" },
};

// Where a page's text comes from: the Markdown itself in one environment variable, or the path
// of a file the operator mounted in another, or, with neither, the placeholder the project ships,
// which says what is missing. Both at once is a mistake the operator hears about at start.
export function legalSource(env: Record<string, string | undefined>, page: LegalPage): LegalSource {
  const settings = SETTINGS[page];
  const markdown = env[settings.markdown];
  const path = env[settings.file]?.trim();
  const hasMarkdown = markdown !== undefined && markdown.trim() !== "";
  if (hasMarkdown && path) throw new Error(`Set ${settings.file} or ${settings.markdown}, not both`);
  if (hasMarkdown) return { from: "environment", markdown };
  if (path) return { from: "file", path };
  return { from: "placeholder" };
}
