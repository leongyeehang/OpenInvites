import { createTranslator } from "next-intl";
import en from "../../messages/en.json";
import { withEnglishFallback, type MessageTree } from "./fallback";
import type { Locale } from "./resolve-locale";

export type Messages = typeof en;

// Every message of one language, with English standing in for any it lacks. The request config
// (request.ts) and mail written outside any request read them from here alike.
export async function messagesFor(locale: Locale): Promise<Messages> {
  const messages: MessageTree = locale === "en" ? en : (await import(`../../messages/${locale}.json`)).default;
  return withEnglishFallback(messages, en) as Messages;
}

// A translator over every message of one language, for mail to guests, which is in the language
// each replied in. It needs no request, so the mail worker's reminders can use it as well as an
// action can (getTranslations reads the request).
export async function translatorFor(locale: Locale) {
  return createTranslator({ locale, messages: await messagesFor(locale) });
}

export type Translator = Awaited<ReturnType<typeof translatorFor>>;
