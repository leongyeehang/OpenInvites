import { getTranslations } from "next-intl/server";
import { areaLook, DBLESS_POOL } from "@/instance/site-look";
import { Glass } from "@/themes/glass";
import { SitePage } from "@/themes/site-page";

// What a request refused by the rate limits is shown in place of the page it asked for. It wears
// the fallback area's poster, chosen without the database (instance/site-look.ts): a 429 must not
// cost a query that may fail.
export async function TooFast() {
  const t = await getTranslations("TooFast");
  return (
    <SitePage look={areaLook(DBLESS_POOL, "fallback")}>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-12">
        <Glass className="flex flex-col gap-3 p-6">
          <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("text")}</p>
        </Glass>
      </main>
    </SitePage>
  );
}
