import { ArrowUpRight, CalendarPlus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { CalendarEvent } from "@/calendar/calendar";
import { googleCalendarHref, outlookHref } from "@/calendar/links";
import { BUBBLE_CHIP } from "@/themes/thread-bubble";

const OPTION =
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-theme-glass-strong px-3 text-sm font-medium hover:bg-theme-glass";

// One tap to the guest's own calendar (spec, "Calendar"): the file for the apps that take one,
// and prefilled entries for the two that live on the web. They sit side by side from the sm
// breakpoint. `inCard` sizes them by the card they are in instead, for the Broadsheet's ballot,
// which is narrower than the screen: side by side only once that card gives each one line
// (32rem, above the 31.5rem the three need). `chips` makes them the chips of the Thread's done
// bubble, which sit among its other chips.
export async function AddToCalendar({ event, link, inCard = false, chips = false }: { event: CalendarEvent; link: string; inCard?: boolean; chips?: boolean }) {
  const t = await getTranslations("EventPage");
  const option = chips ? BUBBLE_CHIP : OPTION;
  const each = (
    <>
      <a href={`${link}/calendar.ics`} download className={option}>
        <CalendarPlus className="size-4" aria-hidden /> {t("addToCalendar")}
      </a>
      <a href={googleCalendarHref(event, link)} target="_blank" rel="noreferrer" className={option}>
        {t("googleCalendar")} <ArrowUpRight className="size-4" aria-hidden />
      </a>
      <a href={outlookHref(event, link)} target="_blank" rel="noreferrer" className={option}>
        {t("outlook")} <ArrowUpRight className="size-4" aria-hidden />
      </a>
    </>
  );
  if (chips) return each;
  const links = <div className={inCard ? "grid gap-2 @lg:grid-cols-3" : "grid gap-2 sm:grid-cols-3"}>{each}</div>;
  return inCard ? <div className="@container">{links}</div> : links;
}
