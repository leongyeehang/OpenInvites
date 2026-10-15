import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { messagesFor } from "./messages";
import { isLocale, LOCALE_COOKIE, resolveLocale, type Locale } from "./resolve-locale";

// A locale named by the caller, as in getTranslations({ locale }), wins over the visitor's own:
// mail to an event's hosts is in the event's language, whoever's request queues it.
export default getRequestConfig(async ({ locale: named }) => {
  const locale = isLocale(named) ? named : await visitorLocale();
  return { locale, messages: await messagesFor(locale) };
});

async function visitorLocale(): Promise<Locale> {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  return resolveLocale({
    cookie: cookieStore.get(LOCALE_COOKIE)?.value,
    acceptLanguage: headerStore.get("accept-language") ?? undefined,
  });
}
