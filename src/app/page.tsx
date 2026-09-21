import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LocaleSwitcher } from "@/locale/locale-switcher";

export default async function HomePage() {
  const t = await getTranslations("Home");
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-xl flex-col justify-center gap-8 px-4 py-12">
      <div className="flex flex-col gap-3">
        <h1 className="text-4xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-lg">{t("status")}</p>
        <p className="text-muted-foreground">{t("tagline")}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href="/sign-in">{t("signIn")}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/sign-up">{t("signUp")}</Link>
        </Button>
      </div>
      <LocaleSwitcher />
    </main>
  );
}
