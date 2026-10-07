import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import en from "../../messages/en.json";
import { withEnglishFallback, type MessageTree } from "./fallback";
import { isLocale, LOCALE_COOKIE, resolveLocale, type Locale } from "./resolve-locale";

// A locale named by the caller, as in getTranslations({ locale }), wins over the visitor's own:
// mail to an event's hosts is in the event's language, whoever's request queues it.
export default getRequestConfig(async ({ locale: named }) => {
  const locale = isLocale(named) ? named : await visitorLocale();
  const messages: MessageTree = locale === "en" ? en : (await import(`../../messages/${locale}.json`)).default;
  return { locale, messages: withEnglishFallback(messages, en) as typeof en };
});

async function visitorLocale(): Promise<Locale> {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  return resolveLocale({
    cookie: cookieStore.get(LOCALE_COOKIE)?.value,
    acceptLanguage: headerStore.get("accept-language") ?? undefined,
  });
}
