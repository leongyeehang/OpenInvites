import { describe, expect, it } from "vitest";
import { resolveLocale } from "./resolve-locale";

describe("resolveLocale", () => {
  it("falls back to English with no cookie and no header", () => {
    expect(resolveLocale({ cookie: undefined, acceptLanguage: undefined })).toBe("en");
  });

  it("prefers the cookie set by the switcher over the browser header", () => {
    expect(resolveLocale({ cookie: "zh-Hant", acceptLanguage: "en-US,en;q=0.9" })).toBe("zh-Hant");
  });

  it("ignores a cookie that is not one of the three locales", () => {
    expect(resolveLocale({ cookie: "fr", acceptLanguage: "zh-CN" })).toBe("zh-Hans");
  });

  it("maps mainland and Singapore Chinese to Simplified", () => {
    expect(resolveLocale({ cookie: undefined, acceptLanguage: "zh-CN,zh;q=0.9,en;q=0.8" })).toBe("zh-Hans");
    expect(resolveLocale({ cookie: undefined, acceptLanguage: "zh-SG" })).toBe("zh-Hans");
    expect(resolveLocale({ cookie: undefined, acceptLanguage: "zh" })).toBe("zh-Hans");
  });

  it("maps Taiwan, Hong Kong and Macau Chinese to Traditional", () => {
    expect(resolveLocale({ cookie: undefined, acceptLanguage: "zh-TW,zh;q=0.9" })).toBe("zh-Hant");
    expect(resolveLocale({ cookie: undefined, acceptLanguage: "zh-HK" })).toBe("zh-Hant");
    expect(resolveLocale({ cookie: undefined, acceptLanguage: "zh-MO" })).toBe("zh-Hant");
  });

  it("honours an explicit script subtag", () => {
    expect(resolveLocale({ cookie: undefined, acceptLanguage: "zh-Hant-CN" })).toBe("zh-Hant");
    expect(resolveLocale({ cookie: undefined, acceptLanguage: "zh-Hans-TW" })).toBe("zh-Hans");
  });

  it("orders languages by quality, not by position", () => {
    expect(resolveLocale({ cookie: undefined, acceptLanguage: "en;q=0.5, zh-TW;q=0.9" })).toBe("zh-Hant");
  });

  it("skips languages the instance does not have", () => {
    expect(resolveLocale({ cookie: undefined, acceptLanguage: "fr-FR, zh-TW;q=0.8" })).toBe("zh-Hant");
    expect(resolveLocale({ cookie: undefined, acceptLanguage: "fr-FR,de;q=0.8" })).toBe("en");
  });

  it("matches regional English and is case-insensitive", () => {
    expect(resolveLocale({ cookie: undefined, acceptLanguage: "en-GB" })).toBe("en");
    expect(resolveLocale({ cookie: undefined, acceptLanguage: "ZH-tw" })).toBe("zh-Hant");
  });
});
