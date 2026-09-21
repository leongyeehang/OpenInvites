import { getLocale, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { locales } from "./resolve-locale";
import { setLocale } from "./set-locale";

// Works without JavaScript: each button submits the form, the server action
// sets the locale cookie, and the page re-renders in the chosen language.
export async function LocaleSwitcher() {
  const [current, t, localeNames] = await Promise.all([
    getLocale(),
    getTranslations("LocaleSwitcher"),
    getTranslations("Locales"),
  ]);

  return (
    <form action={setLocale} aria-labelledby="locale-switcher-label">
      <p id="locale-switcher-label" className="mb-2 text-sm text-muted-foreground">
        {t("label")}
      </p>
      <div className="flex flex-wrap gap-2">
        {locales.map((locale) => (
          <Button
            key={locale}
            type="submit"
            name="locale"
            value={locale}
            lang={locale}
            variant={locale === current ? "default" : "outline"}
            aria-current={locale === current ? "true" : undefined}
          >
            {localeNames(locale)}
          </Button>
        ))}
      </div>
    </form>
  );
}
