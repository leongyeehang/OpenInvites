import { Globe } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";
import { locales } from "./resolve-locale";
import { setLocale } from "./set-locale";

// Every page's footer carries it, so a guest can change the language of an invitation where they
// read it (spec, story 61). Works without JavaScript: each language is a button that submits the
// form, the server action sets the locale cookie, and the page re-renders in the chosen language.
// Each is named in its own language, so anyone can find theirs whatever the page is in now.
export async function LocaleSwitcher({ className, currentClassName }: { className?: string; currentClassName?: string }) {
  const [current, t, localeNames] = await Promise.all([getLocale(), getTranslations("LocaleSwitcher"), getTranslations("Locales")]);

  return (
    <form action={setLocale} aria-label={t("label")} className={cn("flex w-fit flex-wrap items-center justify-center gap-x-3 gap-y-1", className)}>
      <Globe className="size-3.5 shrink-0" aria-hidden />
      {locales.map((locale) => (
        <button
          key={locale}
          type="submit"
          name="locale"
          value={locale}
          lang={locale}
          aria-current={locale === current ? "true" : undefined}
          className={cn("cursor-pointer underline-offset-4 hover:underline", locale === current && cn("font-medium", currentClassName))}
        >
          {localeNames(locale)}
        </button>
      ))}
    </form>
  );
}
