import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TITLE_FONTS } from "@/themes/fonts";
import { Veil } from "@/themes/glass";
import type { FontKey } from "@/themes/theme";

// The heading of an event's management page, in the event's title face with that face's own weight
// and tracking (M8 ticket 21), as the invitation's title is: through a component rather than a rule
// on every h1 in the scope, so a site area's heading (Sign in, Account) keeps the interface's face.
// One with an `id` is where the focus goes once the button that had it is gone with its row, so it
// can be focused by script and draws no ring.
export function ManageHeading({ font, id, children }: { font: FontKey; id?: string; children: ReactNode }) {
  return (
    <h1 id={id} tabIndex={id ? -1 : undefined} className={cn("font-title text-3xl leading-tight", TITLE_FONTS[font].className, id && "outline-none")}>
      {children}
    </h1>
  );
}

// What an event's management page and the reports page open with, on one veil: the way back, the
// heading, and the line or lines under it.
export function ManageIntro({ back, label, heading, children }: { back: string; label: string; heading: ReactNode; children?: ReactNode }) {
  return (
    <Veil className="flex flex-col gap-1">
      <Link href={back} className="w-fit text-sm text-muted-foreground hover:underline">
        {label}
      </Link>
      {heading}
      {children}
    </Veil>
  );
}
