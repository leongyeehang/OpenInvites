import { getTranslations } from "next-intl/server";
import { posterPool } from "@/instance/home";
import { homePage } from "@/instance/repository";
import { areaLook } from "@/instance/site-look";
import { Glass } from "@/themes/glass";
import { SitePage } from "@/themes/site-page";

// A link the host has reset, or the link of an event that was deleted. It used to work, which is a
// different thing from never having existed, and saying so saves the guest wondering whether they
// mistyped it. It wears the guest area's poster from the site's set (instance/site-look.ts).
export async function RetiredLink({ eventDeleted }: { eventDeleted: boolean }) {
  const [t, page] = await Promise.all([getTranslations("EventPage"), homePage()]);
  return (
    <SitePage look={areaLook(posterPool(page), "guest")}>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-12">
        <Glass className="flex flex-col gap-3 p-6">
          <h1 className="text-3xl font-semibold tracking-tight">{t("retiredTitle")}</h1>
          <p className="text-muted-foreground">{eventDeleted ? t("retiredDeleted") : t("retired")}</p>
        </Glass>
      </main>
    </SitePage>
  );
}
