export const locales = ["en", "zh-Hans", "zh-Hant"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

// Cookie written by the language switcher. Locale is never part of the URL.
export const LOCALE_COOKIE = "locale";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

// Cookie set by the switcher, else the browser's Accept-Language header, else English.
export function resolveLocale(input: {
  cookie: string | undefined;
  acceptLanguage: string | undefined;
}): Locale {
  if (isLocale(input.cookie)) return input.cookie;
  for (const tag of preferredLanguageTags(input.acceptLanguage)) {
    const match = matchLocale(tag);
    if (match) return match;
  }
  return defaultLocale;
}

// Accept-Language tags ordered by their quality value, most preferred first.
function preferredLanguageTags(header: string | undefined): string[] {
  if (!header) return [];
  return header
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      const quality = q ? Number(q.slice(2)) : 1;
      return { tag: tag.trim(), quality: Number.isNaN(quality) ? 0 : quality, index };
    })
    .filter((entry) => entry.tag !== "" && entry.quality > 0)
    .sort((a, b) => b.quality - a.quality || a.index - b.index)
    .map((entry) => entry.tag);
}

const traditionalRegions = ["tw", "hk", "mo"];

function matchLocale(tag: string): Locale | undefined {
  const [language, ...subtags] = tag.toLowerCase().split("-");
  if (language === "en") return "en";
  if (language !== "zh") return undefined;
  if (subtags.includes("hant")) return "zh-Hant";
  if (subtags.includes("hans")) return "zh-Hans";
  if (subtags.some((subtag) => traditionalRegions.includes(subtag))) return "zh-Hant";
  return "zh-Hans";
}
