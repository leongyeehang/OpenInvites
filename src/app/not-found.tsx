import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// Its title is its own, whichever address led here (src/proxy.ts sends pages that are not there).
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("NotFound");
  return { title: t("title") };
}

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
