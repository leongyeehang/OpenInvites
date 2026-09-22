import { getTranslations } from "next-intl/server";
import { Glass } from "@/themes/glass";

// What everyone sees at the top of a cancelled event's page: the news, plainly, so a guest who
// opens the link learns it instead of finding nothing (spec, story 63).
export async function CancelledNotice() {
  const t = await getTranslations("EventPage");
  return (
    <Glass strong className="rounded-2xl px-4 py-3 text-sm">
      <p className="font-medium">{t("cancelledTitle")}</p>
      <p className="text-theme-text-muted">{t("cancelled")}</p>
    </Glass>
  );
}
