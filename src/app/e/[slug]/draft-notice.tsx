import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Glass } from "@/themes/glass";

// What the host sees above their own draft's page: a reminder that nobody else can, and the way
// back to editing. In the theme's glass so it sits on the poster page.
export async function DraftNotice({ eventId }: { eventId: string }) {
  const t = await getTranslations("EventPage");
  return (
    <Glass strong className="flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm">
      <p>{t("draftBanner")}</p>
      <Link href={`/events/${eventId}`} className="rounded-full bg-theme-accent px-3 py-1.5 text-xs font-medium text-theme-on-accent hover:opacity-90">
        {t("edit")}
      </Link>
    </Glass>
  );
}
