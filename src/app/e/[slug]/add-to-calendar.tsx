import { ArrowUpRight, CalendarPlus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { CalendarEvent } from "@/calendar/calendar";
import { googleCalendarHref, outlookHref } from "@/calendar/links";

const OPTION =
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-theme-glass-strong px-3 text-sm font-medium hover:bg-theme-glass";

// One tap to the guest's own calendar (spec, "Calendar"): the file for the apps that take one,
// and prefilled entries for the two that live on the web.
export async function AddToCalendar({ event, link }: { event: CalendarEvent; link: string }) {
  const t = await getTranslations("EventPage");
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <a href={`${link}/calendar.ics`} download className={OPTION}>
        <CalendarPlus className="size-4" aria-hidden /> {t("addToCalendar")}
      </a>
      <a href={googleCalendarHref(event, link)} target="_blank" rel="noreferrer" className={OPTION}>
        {t("googleCalendar")} <ArrowUpRight className="size-4" aria-hidden />
      </a>
      <a href={outlookHref(event, link)} target="_blank" rel="noreferrer" className={OPTION}>
        {t("outlook")} <ArrowUpRight className="size-4" aria-hidden />
      </a>
    </div>
  );
}
