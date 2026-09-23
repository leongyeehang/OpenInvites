import { Lock, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";
import type { RsvpCounts } from "@/rsvps/counts";
import type { PublicGuest } from "@/rsvps/repository";
import type { GuestListView } from "@/rsvps/visibility";
import { initialsOf, SectionLabel } from "@/themes/poster-layout";

// The guest list as a guest sees it: a pile of who is coming, the headcount, then everyone as a
// chip. When the host has made it a reward for answering, the pile is there but blurred and
// empty of names, so nothing is given away to anyone who opens the page source.
export async function GuestList({
  view,
  guests,
  counts,
}: {
  view: GuestListView;
  guests: PublicGuest[];
  counts: RsvpCounts;
}) {
  const t = await getTranslations("EventPage");

  if (view === "hidden") return null;

  if (view === "locked") {
    return (
      <>
        <SectionLabel icon={Users}>{t("guests")}</SectionLabel>
        <div aria-hidden className="flex -space-x-2.5 blur-[6px]">
          {[0, 1, 2, 3].map((index) => (
            <span key={index} className="size-9 rounded-full bg-theme-glass-strong ring-2 ring-theme-glass-border" />
          ))}
        </div>
        <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-theme-text-faint">
          <Lock className="size-3.5" aria-hidden /> {t("locked")}
        </p>
      </>
    );
  }

  const going = guests.filter((guest) => guest.status === "going");

  return (
    <>
      <SectionLabel icon={Users}>{t("guests")}</SectionLabel>
      {guests.length === 0 ? (
        <p className="text-sm text-theme-text-muted">{t("nobodyYet")}</p>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <div aria-hidden className="flex -space-x-2.5">
              {going.slice(0, 6).map((guest) => (
                <span
                  key={guest.id}
                  className="grid size-9 place-items-center rounded-full bg-theme-accent text-xs font-medium text-theme-on-accent ring-2 ring-theme-glass-border"
                >
                  {initialsOf(guest.name)}
                </span>
              ))}
            </div>
            <p className="text-sm text-theme-text-muted">
              <span className="text-lg font-medium text-theme-text">{t("headcount", { count: counts.headcount })}</span>
              {counts.maybe > 0 && <span className="text-theme-text-faint"> · {t("alsoMaybe", { count: counts.maybe })}</span>}
            </p>
          </div>
          <ul className="mt-4 flex flex-wrap gap-2">
            {guests.map((guest) => (
              <li
                key={guest.id}
                className="inline-flex h-9 items-center gap-2 rounded-full border border-theme-glass-border px-3 text-sm"
              >
                <span aria-hidden className={cn("size-2 rounded-full", DOT[guest.status])} />
                {guest.name}
                {guest.plusOnes > 0 && <span className="text-theme-text-faint">+{guest.plusOnes}</span>}
                {/* The dot carries the status for the eye; the word carries it for everyone
                    else, and shows plainly for the two a guest cannot guess from a colour. */}
                {guest.status === "going" ? (
                  <span className="sr-only">{t("status.going")}</span>
                ) : (
                  <span className="text-theme-text-faint">{t(`status.${guest.status}`)}</span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

// Going is the accent, Maybe is a faded dot, Can't go is a hollow ring.
const DOT = {
  going: "bg-theme-accent",
  maybe: "bg-current opacity-50",
  cant: "ring-[1.5px] ring-current ring-inset",
} as const;
