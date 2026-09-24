import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import type { MessageTree } from "./fallback";
import { defaultLocale, locales } from "./resolve-locale";
import { translationProblems } from "./translations";

describe("translationProblems", () => {
  const english: MessageTree = {
    Rsvp: {
      hello: "Hello, {name}.",
      size: "Up to {max, number} MB.",
      contact: "Write to <link>{email}</link>.",
      headcount: "{count, plural, =0 {No one yet} =1 {1 person expected} other {# people expected}}",
      tone: "{tone, select, light {Light} dark {Dark} other {Auto}}",
    },
  };
  const chinese: MessageTree = {
    Rsvp: {
      hello: "你好，{name}。",
      size: "最多 {max, number} MB。",
      contact: "请写信至 <link>{email}</link>。",
      // Chinese has only `other`: =1 folds into it, and =0 keeps its own wording.
      headcount: "{count, plural, =0 {还没有人} other {预计 # 人}}",
      tone: "{tone, select, light {浅色} dark {深色} other {自动}}",
    },
  };
  const withRsvp = (patch: Record<string, string>): MessageTree => ({ Rsvp: { ...(chinese.Rsvp as MessageTree), ...patch } });

  it("accepts a translation with every message, even with its plurals folded into other", () => {
    expect(translationProblems(english, chinese, "zh-Hans")).toEqual([]);
    expect(translationProblems(english, withRsvp({ headcount: "{count, plural, other {预计 # 人}}" }), "zh-Hans")).toEqual([]);
  });

  it("names every message that is missing, and every one English does not have", () => {
    const rest = { ...(chinese.Rsvp as MessageTree) };
    delete rest.hello;
    expect(translationProblems(english, { Rsvp: { ...rest, goodbye: "再见" }, Extra: { x: "y" } }, "zh-Hans")).toEqual([
      "Rsvp.hello is missing",
      "Rsvp.goodbye is not in English",
      "Extra is not in English",
    ]);
    expect(translationProblems(english, {}, "zh-Hans")).toEqual(["Rsvp is missing"]);
    expect(translationProblems(english, withRsvp({ hello: "" }), "zh-Hans")).toEqual(["Rsvp.hello is empty"]);
  });

  it("finds a placeholder that is lost, renamed, or used another way", () => {
    expect(translationProblems(english, withRsvp({ hello: "你好。" }), "zh-Hans")).toEqual(["Rsvp.hello lacks {name}"]);
    expect(translationProblems(english, withRsvp({ hello: "你好，{nom}。" }), "zh-Hans")).toEqual([
      "Rsvp.hello lacks {name}",
      "Rsvp.hello has {nom}, which English does not",
    ]);
    expect(translationProblems(english, withRsvp({ size: "最多 {max} MB。" }), "zh-Hans")).toEqual([
      "Rsvp.size uses {max} as argument, where English uses it as number",
    ]);
    expect(translationProblems(english, withRsvp({ contact: "请写信至 {email}。" }), "zh-Hans")).toEqual(["Rsvp.contact lacks {link}"]);
  });

  it("keeps a select's branches and a plural's number, and a plural to the language's own branches", () => {
    expect(translationProblems(english, withRsvp({ tone: "{tone, select, light {浅色} other {自动}}" }), "zh-Hans")).toEqual([
      "Rsvp.tone needs the branches light, dark, other for {tone}",
    ]);
    expect(translationProblems(english, withRsvp({ headcount: "{count, plural, other {预计几人}}" }), "zh-Hans")).toEqual([
      "Rsvp.headcount drops the number (#) from {count}",
    ]);
    expect(translationProblems(english, withRsvp({ headcount: "{count, plural, one {预计 1 人} other {预计 # 人}}" }), "zh-Hans")).toEqual([
      'Rsvp.headcount has a "one" branch for {count}, which zh-Hans never uses',
    ]);
  });

  it("reports a message that cannot be read", () => {
    expect(translationProblems(english, withRsvp({ hello: "你好，{name" }), "zh-Hans")).toEqual([
      "Rsvp.hello cannot be read: EXPECT_ARGUMENT_CLOSING_BRACE",
    ]);
  });
});

describe("the translation files", () => {
  for (const locale of locales.filter((each) => each !== defaultLocale)) {
    it(`give ${locale} every English message, with its placeholders and branches`, () => {
      const messages = JSON.parse(readFileSync(`messages/${locale}.json`, "utf8")) as MessageTree;
      expect(translationProblems(en, messages, locale)).toEqual([]);
    });
  }
});
