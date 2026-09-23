import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("TooFast");
  return { title: t("title"), robots: { index: false, follow: false } };
}

// What a page request refused by the rate limits gets (src/proxy.ts), with 429 and Retry-After.
export default async function TooFastPage() {
  const t = await getTranslations("TooFast");
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-xl flex-col justify-center gap-3 px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="text-muted-foreground">{t("text")}</p>
    </main>
  );
}
