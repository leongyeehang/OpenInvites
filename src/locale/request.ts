import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import en from "../../messages/en.json";
import { withEnglishFallback, type MessageTree } from "./fallback";
import { LOCALE_COOKIE, resolveLocale } from "./resolve-locale";

export default getRequestConfig(async () => {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const locale = resolveLocale({
    cookie: cookieStore.get(LOCALE_COOKIE)?.value,
    acceptLanguage: headerStore.get("accept-language") ?? undefined,
  });
  const messages: MessageTree = locale === "en" ? en : (await import(`../../messages/${locale}.json`)).default;
  return { locale, messages: withEnglishFallback(messages, en) as typeof en };
});
