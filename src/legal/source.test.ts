import { describe, expect, it } from "vitest";
import { legalSource } from "./source";

describe("legalSource", () => {
  it("falls back to the shipped placeholder when the operator has given nothing", () => {
    expect(legalSource({}, "privacy")).toEqual({ from: "placeholder" });
    expect(legalSource({ PRIVACY_POLICY_FILE: " ", PRIVACY_POLICY_MARKDOWN: "\n" }, "privacy")).toEqual({ from: "placeholder" });
  });

  it("takes the operator's Markdown from the environment", () => {
    expect(legalSource({ PRIVACY_POLICY_MARKDOWN: "## What we keep\n\nYour name." }, "privacy")).toEqual({
      from: "environment",
      markdown: "## What we keep\n\nYour name.",
    });
  });

  it("takes the path of a file the operator mounted", () => {
    expect(legalSource({ PRIVACY_POLICY_FILE: " /legal/privacy.md " }, "privacy")).toEqual({ from: "file", path: "/legal/privacy.md" });
  });

  it("reads each page's own pair of settings", () => {
    const env = { PRIVACY_POLICY_MARKDOWN: "Privacy text", TERMS_FILE: "/legal/terms.md" };
    expect(legalSource(env, "privacy")).toEqual({ from: "environment", markdown: "Privacy text" });
    expect(legalSource(env, "terms")).toEqual({ from: "file", path: "/legal/terms.md" });
    expect(legalSource({ TERMS_MARKDOWN: "Terms text" }, "terms")).toEqual({ from: "environment", markdown: "Terms text" });
    expect(legalSource({ TERMS_MARKDOWN: "Terms text" }, "privacy")).toEqual({ from: "placeholder" });
  });

  it("refuses both a file and contents for one page, naming them, rather than guess which the operator meant", () => {
    expect(() => legalSource({ TERMS_FILE: "/legal/terms.md", TERMS_MARKDOWN: "Terms text" }, "terms")).toThrow(/TERMS_FILE.*TERMS_MARKDOWN/);
    expect(() => legalSource({ PRIVACY_POLICY_FILE: "/p.md", PRIVACY_POLICY_MARKDOWN: "Text" }, "privacy")).toThrow(
      /PRIVACY_POLICY_FILE.*PRIVACY_POLICY_MARKDOWN/,
    );
  });
});
