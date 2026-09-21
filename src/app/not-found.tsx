import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function NotFound() {
  const t = await getTranslations("NotFound");
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-xl flex-col justify-center gap-4 px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="text-muted-foreground">{t("text")}</p>
      <Button asChild className="self-start">
        <Link href="/">{t("home")}</Link>
      </Button>
    </main>
  );
}
