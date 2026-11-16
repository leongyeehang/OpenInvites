import { AlignLeft, Clock, MapPin } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ComponentType, ReactNode } from "react";
import type { EventWithHost } from "@/events/repository";
import { formatWhen, isDated } from "@/events/time";
import { cn } from "@/lib/utils";
import { RichTextView } from "@/rich-text/rich-text-view";
import type { SectionDrawing } from "@/sections";
import { BroadsheetSection } from "../broadsheet-section";
import { Glass } from "../glass";
import { CAPS, IconTile } from "../poster-parts";
import { BubbleLabel, HostBubble } from "../thread-bubble";
import type { SectionPage } from "./drawings";

// The details (M4 spec, "The guest page"): When, Where and About as one frosted list, each row
// with its icon, and under each what the guest's own device adds: their clock and the countdown,
// their maps app, their calendar. While guests vote on the date (M4 ticket 09), the When row holds
// the candidates and the way into the vote. Always on, whatever the arrangement (M8 spec).
type Details = { event: EventWithHost; locale: string } & SectionPage["details"];

async function DetailRows({ event, locale, underWhen, underWhere, calendar, poll }: Details) {
  const t = await getTranslations("EventPage");
  return (
    <>
      {isDated(event) ? (
        <DetailRow icon={Clock} label={t("when")}>
          <p className="text-base leading-snug font-medium">{formatWhen(event, locale)}</p>
          {underWhen}
          {calendar && <div className="mt-3">{calendar}</div>}
        </DetailRow>
      ) : (
        poll && (
          <DetailRow icon={Clock} label={t("when")} slot="poll">
            {poll}
          </DetailRow>
        )
      )}
      {event.location && (
        <DetailRow icon={MapPin} label={t("where")}>
          <p className="text-base leading-snug font-medium break-words">{event.location}</p>
          {underWhere}
        </DetailRow>
      )}
      {event.descriptionRich.blocks.length > 0 && (
        <DetailRow icon={AlignLeft} label={t("about")} slot="description">
          <RichTextView doc={event.descriptionRich} className="leading-relaxed text-theme-text-muted" />
        </DetailRow>
      )}
    </>
  );
}

// One row of the details list: its icon in a small tile, its heading, and what it says.
export function DetailRow({ icon: Icon, label, slot, children }: { icon: ComponentType<{ className?: string }>; label: string; slot?: string; children: ReactNode }) {
  return (
    <section data-slot={slot} className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-3 p-4">
      <IconTile>
        <Icon className="size-4.5" />
      </IconTile>
      <div className="min-w-0 pt-0.5">
        <h2 className={cn(CAPS, "mb-1 text-theme-text-faint")}>{label}</h2>
        {children}
      </div>
    </section>
  );
}

// The Broadsheet's details (M8 ticket 27): its header keeps When, Where and the Host, so the
// section is the description, in two columns on a wider screen, or nothing without one.
async function BroadsheetDetails({ event, sectionKey, className }: { event: EventWithHost; sectionKey: string; className: string }) {
  if (event.descriptionRich.blocks.length === 0) return null;
  const t = await getTranslations("EventPage");
  return (
    <BroadsheetSection label={t("broadsheet.details")} data-slot="description" data-section={sectionKey} className={className}>
      <RichTextView doc={event.descriptionRich} className="text-[17px] leading-relaxed sm:columns-2 sm:gap-8 [&>*]:break-inside-avoid" />
    </BroadsheetSection>
  );
}

// The Thread's details (M8 ticket 27): the description, When and Where, each a host's bubble of
// its own, in a row and arriving together, each carrying the section's key.
async function ThreadDetails({ event, locale, underWhen, underWhere, sectionKey, className }: Details & { sectionKey: string; className: string }) {
  const t = await getTranslations("EventPage");
  return (
    <>
      {event.descriptionRich.blocks.length > 0 && (
        <HostBubble data-slot="description" data-section={sectionKey} className={className}>
          <RichTextView doc={event.descriptionRich} />
        </HostBubble>
      )}
      {isDated(event) && (
        <HostBubble data-section={sectionKey} className={className}>
          <BubbleLabel icon={Clock}>{t("when")}</BubbleLabel>
          <p className="font-medium">{formatWhen(event, locale)}</p>
          {underWhen}
        </HostBubble>
      )}
      {event.location && (
        <HostBubble data-section={sectionKey} className={className}>
          <BubbleLabel icon={MapPin}>{t("where")}</BubbleLabel>
          <p className="font-medium">{event.location}</p>
          {underWhere}
        </HostBubble>
      )}
    </>
  );
}

// Every layout frames the details itself: the Poster as one list with a rule between rows and no
// heading, the Broadsheet as its description, the Thread as bubbles.
export const detailsDrawing: SectionDrawing<Details, SectionPage> = {
  load: async ({ event, locale, details }) => ({ event, locale, ...details }),
  shown: () => ({ count: null }),
  body: (details) => <DetailRows {...details} />,
  whole: {
    poster: (details, placed, className) => (
      <Glass data-slot="details" data-section={placed.key} className={cn("divide-y divide-theme-glass-border overflow-hidden rounded-[1.75rem]", className)}>
        <DetailRows {...details} />
      </Glass>
    ),
    broadsheet: (details, placed, className) => <BroadsheetDetails event={details.event} sectionKey={placed.key} className={className} />,
    thread: (details, placed, className) => <ThreadDetails {...details} sectionKey={placed.key} className={className} />,
  },
};
