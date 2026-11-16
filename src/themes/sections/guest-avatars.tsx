import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";
import type { RsvpCounts } from "@/rsvps/counts";
import type { PublicGuest } from "@/rsvps/repository";
import { initialsOf } from "../poster-parts";
import { firstNameOf } from "../thread-script";

// Who's coming as avatars (M8 ticket 30), the host's other style for the list, drawn alike by
// every layout inside its own frame, and only while the list is open to this viewer: a locked list
// is the layout's own promise of names, whatever the style. The headcount first, as each layout's
// list gives it; then everyone who has replied as a circle of their initials, in the accent for
// those going, over their first name, with what they said under it in words. The viewer's own is
// marked. The first name is for the eye; a screen reader is told the whole name.
export async function GuestAvatars({ guests, counts, you }: { guests: PublicGuest[]; counts: RsvpCounts; you?: string }) {
  const t = await getTranslations("EventPage");
  if (guests.length === 0) return <p className="text-sm text-theme-text-muted">{t("nobodyYet")}</p>;
  return (
    <>
      <p className="font-medium">
        {t("headcount", { count: counts.headcount })}
        {counts.maybe > 0 && <span className="font-normal text-theme-text-faint"> · {t("alsoMaybe", { count: counts.maybe })}</span>}
      </p>
      <ul data-style="avatars" className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-x-2 gap-y-4">
        {guests.map((guest) => (
          <li key={guest.id} className="flex min-w-0 flex-col items-center gap-1 text-center">
            <span
              aria-hidden
              data-slot="avatar"
              className={cn(
                "grid size-12 shrink-0 place-items-center rounded-full text-sm font-medium",
                guest.status === "going" ? "bg-theme-accent text-theme-on-accent" : "ring-1 ring-current/30",
              )}
            >
              {initialsOf(guest.name)}
            </span>
            <span className="max-w-full truncate text-sm font-medium">
              <span aria-hidden>{firstNameOf(guest.name)}</span>
              <span className="sr-only">{guest.name}</span>
              {guest.plusOnes > 0 && <span className="font-normal text-theme-text-faint"> +{guest.plusOnes}</span>}
            </span>
            <span className="text-xs text-theme-text-faint">
              {t(`status.${guest.status}`)}
              {guest.id === you && <> {t("thread.you")}</>}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
