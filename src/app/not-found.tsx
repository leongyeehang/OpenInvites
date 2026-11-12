import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { areaLook, DBLESS_POOL } from "@/instance/site-look";
import { Glass } from "@/themes/glass";
import { SitePage } from "@/themes/site-page";

// Its title is its own, whichever address led here (src/proxy.ts sends pages that are not there).
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("NotFound");
  return { title: t("title") };
}

// Drawn without the database, so it wears the fallback area's poster (instance/site-look.ts).
export default async function NotFound() {
  const t = await getTranslations("NotFound");
  return (
    <SitePage look={areaLook(DBLESS_POOL, "fallback")}>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-12">
        <Glass className="flex flex-col gap-4 p-6">
          <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("text")}</p>
          <Button asChild className="self-start">
            <Link href="/">{t("home")}</Link>
          </Button>
        </Glass>
      </main>
    </SitePage>
  );
}
