import { Lock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { GuestList } from "@/app/e/[slug]/guest-list";
import { cn } from "@/lib/utils";
import type { Approval } from "@/rsvps/admission";
import type { RsvpCounts } from "@/rsvps/counts";
import type { PublicGuest } from "@/rsvps/repository";
import type { SectionDrawing } from "@/sections";
import { BroadsheetGuestList } from "../broadsheet-guest-list";
import { initialsOf } from "../poster-parts";
import type { SectionPage } from "./drawings";

// Who's coming as this viewer may see it (rsvps/visibility.ts), worked out by the page: absent when
// the host hides the list, locked to a guest who has not replied or whose reply waits for the
// host, and otherwise the guests themselves. `you` is the viewer's own RSVP, when they have one,
// which the Broadsheet and the Thread mark, and `approval` whether the host has approved it, which
// says why the list is locked for them.
export type GuestListShown = { view: "open" | "locked"; guests: PublicGuest[]; counts: RsvpCounts; you?: string; approval?: Approval };

// Who's coming in the Thread (M8 ticket 27, from the Thread layout): everyone who has replied, with
// what they said, the viewer's own line marked; or, before the guest has replied under "after you
// reply", a blurred pile and the promise of the names, of which nothing reaches the browser. The
// frame is the section's host bubble and its label.
async function WhoIsComing({ view, guests, counts, you, approval }: GuestListShown) {
  const t = await getTranslations("EventPage");
  if (view === "locked") {
    return (
      <div className="flex items-center gap-3">
        <div aria-hidden className="flex -space-x-1.5 blur-[3px]">
          {[0, 1, 2, 3].map((index) => (
            <span key={index} className="size-6 rounded-full bg-current/25 ring-2 ring-theme-glass-border" />
          ))}
        </div>
        <p className="inline-flex items-center gap-1 text-sm text-theme-text-faint">
          <Lock className="size-3.5" aria-hidden />{" "}
          {approval === "pending" ? t("lockedPending") : approval === "declined" ? t("lockedDeclined") : t("thread.locked")}
        </p>
      </div>
    );
  }
  if (guests.length === 0) return <p>{t("nobodyYet")}</p>;
  return (
    <>
      <p className="font-medium">
        {t("headcount", { count: counts.headcount })}
        {counts.maybe > 0 && <span className="font-normal text-theme-text-faint"> · {t("alsoMaybe", { count: counts.maybe })}</span>}
      </p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {guests.map((guest) => (
          <li key={guest.id} className="flex items-center gap-2">
            <span
              aria-hidden
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-medium",
                guest.id === you ? "bg-theme-accent text-theme-on-accent" : "ring-1 ring-current/30",
              )}
            >
              {initialsOf(guest.name)}
            </span>
            <span className="min-w-0 flex-1">
              {guest.name}
              {guest.id === you && <span className="text-theme-text-faint"> {t("thread.you")}</span>}
              {guest.plusOnes > 0 && <span className="text-theme-text-faint"> +{guest.plusOnes}</span>}
            </span>
            <span className="shrink-0 text-sm text-theme-text-faint">{t(`status.${guest.status}`)}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

// The guest list as a section (M8 ticket 25), drawn in each layout's own way (ticket 27). The frame
// heads it; the count beside a collapsed heading is how many guests are listed.
export const guestsDrawing: SectionDrawing<GuestListShown, SectionPage> = {
  load: async ({ guestList }) => guestList,
  shown: (list) => ({ count: list.view === "open" ? list.guests.length : null, locked: list.view === "locked" }),
  body: (list, layout) =>
    layout === "broadsheet" ? <BroadsheetGuestList {...list} /> : layout === "thread" ? <WhoIsComing {...list} /> : <GuestList {...list} />,
};
