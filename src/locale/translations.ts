import { parse, TYPE, type MessageFormatElement } from "@formatjs/icu-messageformat-parser";
import type { MessageTree } from "./fallback";

// What makes a translation file complete (spec, story 101: adding a language is adding a file).
// It has every message English has, and no other, and each message keeps English's placeholders:
// the same names, each used the same way (plain, number, plural, select, or rich-text tag).
// A select keeps English's branches, as they name the values the interface passes. A plural
// keeps `other` and its number (#) but has only the branches its own language needs: its CLDR
// plural categories, plus any exact number (=0) it wants to word apart. Chinese has only `other`,
// so a Chinese plural can be `other` alone. The problems come back as sentences, one per slip.
export function translationProblems(english: MessageTree, translation: MessageTree, locale: string): string[] {
  const problems: string[] = [];
  compareTrees(english, translation, locale, "", problems);
  return problems;
}

function compareTrees(english: MessageTree, translation: MessageTree, locale: string, prefix: string, problems: string[]) {
  for (const [key, source] of Object.entries(english)) {
    const path = prefix + key;
    const translated = translation[key];
    if (translated === undefined) problems.push(`${path} is missing`);
    else if (typeof source === "string" && typeof translated === "string") compareMessages(source, translated, locale, path, problems);
    else if (typeof source === "object" && typeof translated === "object") compareTrees(source, translated, locale, `${path}.`, problems);
    else problems.push(`${path} should be ${typeof source === "string" ? "a message" : "a group of messages"}`);
  }
  for (const key of Object.keys(translation)) {
    if (!(key in english)) problems.push(`${prefix + key} is not in English`);
  }
}

type Use = { kind: string; branches: Set<string>; pound: boolean };

function compareMessages(source: string, translated: string, locale: string, path: string, problems: string[]) {
  if (translated.trim() === "") return void problems.push(`${path} is empty`);
  let theirs: Map<string, Use>;
  try {
    theirs = usesIn(parse(translated));
  } catch (error) {
    return void problems.push(`${path} cannot be read: ${(error as Error).message}`);
  }
  const ours = usesIn(parse(source));
  const categories = new Set(new Intl.PluralRules(locale).resolvedOptions().pluralCategories);

  for (const [name, use] of ours) {
    const their = theirs.get(name);
    if (!their) {
      problems.push(`${path} lacks {${name}}`);
      continue;
    }
    if (their.kind !== use.kind) {
      problems.push(`${path} uses {${name}} as ${their.kind}, where English uses it as ${use.kind}`);
      continue;
    }
    if (use.kind === "select" && [...use.branches].sort().join() !== [...their.branches].sort().join()) {
      problems.push(`${path} needs the branches ${[...use.branches].join(", ")} for {${name}}`);
    }
    if (use.kind === "plural") {
      for (const branch of their.branches) {
        if (!branch.startsWith("=") && !categories.has(branch as Intl.LDMLPluralRule)) {
          problems.push(`${path} has a "${branch}" branch for {${name}}, which ${locale} never uses`);
        }
      }
      if (use.pound && !their.pound) problems.push(`${path} drops the number (#) from {${name}}`);
    }
  }
  for (const name of theirs.keys()) {
    if (!ours.has(name)) problems.push(`${path} has {${name}}, which English does not`);
  }
}

// Every placeholder in a message, however deep in its branches and tags, and how it is used.
function usesIn(elements: MessageFormatElement[], uses = new Map<string, Use>(), plural?: Use): Map<string, Use> {
  for (const element of elements) {
    if (element.type === TYPE.literal) continue;
    if (element.type === TYPE.pound) {
      if (plural) plural.pound = true;
      continue;
    }
    const kind = element.type === TYPE.plural && element.pluralType === "ordinal" ? "selectordinal" : TYPE[element.type];
    const use = uses.get(element.value) ?? { kind, branches: new Set<string>(), pound: false };
    // A name used two ways in one message is its own slip; the first way stands for it.
    uses.set(element.value, use);
    if (element.type === TYPE.tag) usesIn(element.children, uses, plural);
    if (element.type === TYPE.select || element.type === TYPE.plural) {
      for (const [branch, option] of Object.entries(element.options)) {
        use.branches.add(branch);
        usesIn(option.value, uses, element.type === TYPE.plural ? use : plural);
      }
    }
  }
  return uses;
}
