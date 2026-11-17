import { getTranslations } from "next-intl/server";
import { posterPool } from "@/instance/home";
import { homePage } from "@/instance/repository";
import { areaLook } from "@/instance/site-look";
import { Glass } from "@/themes/glass";
import { SitePage } from "@/themes/site-page";

// A draft, to anyone but its hosts: it is not public yet, and says only that. It wears the guest
// area's poster from the site's set, never the draft's Theme (instance/site-look.ts).
export async function NotReady() {
  const [t, page] = await Promise.all([getTranslations("EventPage"), homePage()]);
  return (
    <SitePage look={areaLook(posterPool(page), "guest")}>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-12">
        <Glass className="flex flex-col gap-3 p-6">
          <h1 className="text-3xl font-semibold tracking-tight">{t("notReadyTitle")}</h1>
          <p className="text-muted-foreground">{t("notReady")}</p>
        </Glass>
      </main>
    </SitePage>
  );
}
