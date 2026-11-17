import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import type { ReactNode } from "react";
import { AlbumReminderNotice } from "@/album/album-reminder-notice";
import type { AlbumTotals } from "@/album/album";
import { albumTotalsByEvent } from "@/album/repository";
import { requireHost } from "@/auth/session";
import { Button } from "@/components/ui/button";
import { hostLook } from "@/dashboard/host-look";
import { shelve, showsYear, tileChip, tileNumber, whenKind, type ShelfEvent, type TileChip } from "@/dashboard/shelves";
import { eventsOwnedAtLimit } from "@/events/limit";
import { listHostEvents } from "@/events/repository";
import { featureOn, siteFeatures } from "@/features";
import { formatDay, formatWhen, formatWhenBrief, isDated } from "@/events/time";
import type { Limits } from "@/instance/limits";
import { pickPoster, posterPool } from "@/instance/home";
import { homePage, instanceLimits, operatorToWelcome, registrationMode } from "@/instance/repository";
import { cn } from "@/lib/utils";
import { ClientMessages } from "@/locale/client-messages";
import { retentionFloorDays } from "@/retention/floor";
import { deletionDate } from "@/retention/plan";
import { NO_RSVPS } from "@/rsvps/counts";
import { countRsvpsByEvent } from "@/rsvps/repository";
import { Glass, Veil } from "@/themes/glass";
import { PosterTile } from "@/themes/poster-tile";
import { LONG_TITLE } from "@/themes/title-fonts";
import { findGalleryPoster } from "@/themes/posters";
import type { ThemeUpload } from "@/themes/resolve";
import type { Theme } from "@/themes/theme";
import { findEventUploads } from "@/uploads/repository";
import { themeUpload } from "@/uploads/uploads";
import { OperatorWelcome } from "./operator-welcome";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Host.dashboard");
  return { title: t("title") };
}

type Translate = Awaited<ReturnType<typeof getTranslations<"Host.dashboard">>>;

// The dashboard as a shelf of invitations (dashboard spec, "What the dashboard shows"): the host's
// next event first and large, with its replies and the ways to manage it, then every other event as
// its poster under Coming up, Drafts and Past. It sits in the host's frame, on the poster of their
// next event (dashboard/host-look.ts), with the heading on the veil and Next up, the empty state and
// each shelf a glass panel, never one inside another (M8 ticket 20). Which event goes where is
// shelves.ts's to say; this page only draws it. A new operator is first welcomed on it, once.
export default async function DashboardPage() {
  const host = await requireHost();
  const [t, locale, events, limits, welcome, atLimit, switches] = await Promise.all([
    getTranslations("Host.dashboard"),
    getLocale(),
    listHostEvents(host.id),
    instanceLimits(),
    operatorToWelcome(host.id),
    eventsOwnedAtLimit(host.id),
    siteFeatures(),
  ]);
  const ids = events.map((event) => event.id);
  // The albums the clock reminded the host about, while they hold anything (M7 ticket 09), and
  // none while the operator has the Album switched off (M8 ticket 01).
  const albumOn = featureOn(switches, "album");
  const reminded = events.filter((event) => albumOn && event.albumRemindedAt !== null && event.albumReminderDays !== null);
  const [counts, uploads, albums] = await Promise.all([
    countRsvpsByEvent(ids),
    findEventUploads(events.filter((event) => event.theme.poster.kind === "upload").map((event) => event.id)),
    albumTotalsByEvent(reminded.map((event) => event.id)),
  ]);
  const reminders = reminded.flatMap((event) => {
    const album = albums.get(event.id);
    return album && album.photos + album.videos > 0 ? [{ id: event.id, title: event.title, album }] : [];
  });
  const now = new Date();
  const shelves = shelve(
    events.map((event) => ({
      ...event,
      counts: counts.get(event.id) ?? NO_RSVPS,
      deletion: deletionDate(event, limits.retentionDays, retentionFloorDays()) ?? null,
    })),
    now,
  );
  const pictureOf = (event: ShelfEvent): ThemeUpload | null => {
    const upload = uploads.get(event.id);
    return upload ? themeUpload(upload) : null;
  };
  // With no events yet, the first invitation's tile wears the poster the page is on (hostLook).
  const first = events.length === 0 ? (await hostLook(host.id)).theme : null;
  const tile = { t, locale, now };

  return (
    <div data-slot="dashboard" className="flex flex-col gap-8">
      {welcome && <Welcome limits={limits} />}
      <Veil className="flex flex-col gap-2">
        <h1 tabIndex={-1} className="text-3xl font-bold tracking-tight outline-none">
          {t("title")}
        </h1>
        {atLimit !== undefined && <p className="text-sm text-muted-foreground">{t("limitReached", { count: atLimit })}</p>}
      </Veil>
      {reminders.length > 0 && <AlbumReminders reminders={reminders} t={t} />}
      {first && <FirstInvitation theme={first} t={t} />}
      {shelves.nextUp && <NextUp event={shelves.nextUp} upload={pictureOf(shelves.nextUp)} t={t} locale={locale} />}
      <Shelf id="coming-up" heading={t("comingUp")} events={shelves.comingUp} shelf="comingUp" pictureOf={pictureOf} {...tile} />
      <Shelf id="drafts" heading={t("drafts")} events={shelves.drafts} shelf="drafts" pictureOf={pictureOf} {...tile} />
      <Shelf id="past" heading={t("past")} events={shelves.past} shelf="past" pictureOf={pictureOf} {...tile} />
    </div>
  );
}

// The albums the host was reminded about, under a heading on the veil, as one glass panel whose
// rows are divided by the glass's edge (the part review after M8 ticket 23): the event, what its
// album holds, Empty the album and Keep it; gone once answered or emptied.
function AlbumReminders({ reminders, t }: { reminders: { id: string; title: string; album: AlbumTotals }[]; t: Translate }) {
  return (
    <ClientMessages namespaces={["Events.album"]}>
      <section aria-labelledby="album-reminders-heading" className="flex flex-col gap-3">
        <Veil>
          <h2 id="album-reminders-heading" className="text-lg font-semibold tracking-tight">
            {t("albumReminders.title")}
          </h2>
        </Veil>
        <Glass>
          <ul className="flex flex-col divide-y divide-theme-glass-border">
            {reminders.map(({ id, title, album }) => (
              <li key={id} className="p-4">
                <AlbumReminderNotice eventId={id} album={album} title={title || t("untitled")} />
              </li>
            ))}
          </ul>
        </Glass>
      </section>
    </ClientMessages>
  );
}

async function Welcome({ limits }: { limits: Limits }) {
  const [home, mode] = await Promise.all([homePage(), registrationMode()]);
  return (
    <ClientMessages namespaces={["Dashboard.operatorWelcome"]}>
      <OperatorWelcome
        poster={findGalleryPoster(pickPoster(posterPool(home)))!.card}
        instanceName={home.instanceName}
        mode={mode}
        maxEventsPerHost={limits.maxEventsPerHost}
        retentionDays={limits.retentionDays}
      />
    </ClientMessages>
  );
}

function FirstInvitation({ theme, t }: { theme: Theme; t: Translate }) {
  return (
    <section aria-labelledby="first-heading">
      <Glass className="grid gap-5 p-3 sm:grid-cols-[14rem_1fr] sm:items-center">
        <PosterTile theme={theme} upload={null} sizes="14rem" priority className="max-sm:mx-auto max-sm:max-w-60" />
        <div className="flex flex-col items-start gap-3 px-2 pb-3 sm:pb-0">
          <h2 id="first-heading" className="text-2xl font-bold tracking-tight text-balance">
            {t("firstTitle")}
          </h2>
          <p className="text-muted-foreground">{t("firstText")}</p>
          <Button asChild className="mt-1 h-10 rounded-full border-0 px-5 font-semibold">
            <Link href="/events/new">{t("firstButton")}</Link>
          </Button>
        </div>
      </Glass>
    </section>
  );
}

const button = "inline-flex h-10 flex-1 items-center justify-center rounded-full px-4 text-sm font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

// The next event: its poster, when it is, how its replies stand and what needs the host, and the
// three pages a host goes to most, in one glass panel with its heading. On a phone the poster is
// above; from md it is beside, and the replies become large figures. Its links keep their fills
// hovered, which their words are proven on, and show the hover by an edge in their words' colour:
// Guests is a default button, which the site page's scope edges (globals.css); Edit and Share are
// drawn by hand in the secondary fill and edge themselves, as the scope proves no hover for a
// secondary button yet (docs/contributing/backgrounds.md, "Every other page").
function NextUp({ event, upload, t, locale }: { event: ShelfEvent; upload: ThemeUpload | null; t: Translate; locale: string }) {
  const { going, maybe, cant, waitlisted, pending, headcount } = event.counts;
  const figure = (key: "going" | "maybe" | "cant" | "waitlisted" | "toApprove", count: number, attention = false) => (
    <li
      className={cn(
        "rounded-full bg-muted px-2.5 py-1 text-xs font-semibold tabular-nums md:flex md:flex-col md:rounded-2xl md:px-4 md:py-3 md:text-sm md:font-medium",
        attention ? "bg-attention-soft text-attention" : "md:text-muted-foreground",
      )}
    >
      {t.rich(key, { count, n: (chunks) => <span className={cn("md:block md:text-3xl md:font-bold md:tracking-tight", !attention && "md:text-foreground")}>{chunks}</span> })}
    </li>
  );
  return (
    <section aria-labelledby="next-up-heading">
      <Glass className="flex flex-col gap-3 p-2 md:p-3">
        <h2 id="next-up-heading" className="px-2 pt-2 text-xs font-bold tracking-[0.08em] text-muted-foreground uppercase">
          {t("nextUp")}
        </h2>
        <div className="grid gap-4 md:grid-cols-[18rem_1fr] md:gap-7">
          <Link href={`/events/${event.id}`} className="rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <PosterTile
              theme={event.theme}
              upload={upload}
              title={event.title || t("untitled")}
              sizes="(min-width: 48rem) 18rem, calc(100vw - 3rem)"
              priority
              titleClassName={cn("line-clamp-4", (event.title || t("untitled")).length > LONG_TITLE ? "text-3xl md:text-4xl" : "text-4xl md:text-5xl")}
            />
          </Link>
          <div className="flex min-w-0 flex-col gap-4 px-2 pb-2 md:py-3 md:pr-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold md:text-lg">{whenKind(event) === "poll" ? t("datePoll") : isDated(event) ? formatWhen(event, locale) : t("noDate")}</p>
              {event.role === "coHost" && <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold">{t("coHost")}</span>}
            </div>
            <ul className="flex flex-wrap gap-1.5 md:grid md:grid-cols-4 md:gap-2.5">
              {figure("going", going)}
              {figure("maybe", maybe)}
              {figure("cant", cant)}
              {waitlisted > 0 && figure("waitlisted", waitlisted)}
              {pending > 0 && figure("toApprove", pending, true)}
            </ul>
            <p className="text-sm text-muted-foreground">
              {event.capacity === null ? t("headcount", { count: headcount }) : t("headcountOf", { count: headcount, capacity: event.capacity })}
            </p>
            {event.deletion && (
              <p className="w-fit rounded-full bg-destructive-soft px-2.5 py-1 text-xs font-semibold text-destructive">
                {t("deletedOn", { date: formatDay(event.deletion, event.timeZone, locale) })}
              </p>
            )}
            <div className="mt-auto flex gap-2">
              <Button asChild className="h-10 flex-1 rounded-full border-0 px-4 font-semibold">
                <Link href={`/events/${event.id}/guests`}>{t("guests")}</Link>
              </Button>
              <Link href={`/events/${event.id}`} className={cn(button, "bg-secondary text-secondary-foreground hover:inset-ring hover:inset-ring-secondary-foreground")}>
                {t("edit")}
              </Link>
              <Link href={`/events/${event.id}/share`} className={cn(button, "bg-secondary text-secondary-foreground hover:inset-ring hover:inset-ring-secondary-foreground")}>
                {t("share")}
              </Link>
            </div>
          </div>
        </div>
      </Glass>
    </section>
  );
}

// A shelf of tiles in a glass panel with its heading, drawn only when it has events: two across on a
// phone and four from md, except Past, which on a phone is one row that scrolls sideways inside its
// panel, out to the panel's edges, its posters faded.
function Shelf({
  id,
  heading,
  events,
  shelf,
  pictureOf,
  t,
  locale,
  now,
}: {
  id: string;
  heading: string;
  events: ShelfEvent[];
  shelf: "comingUp" | "drafts" | "past";
  pictureOf: (event: ShelfEvent) => ThemeUpload | null;
  t: Translate;
  locale: string;
  now: Date;
}) {
  if (events.length === 0) return null;
  const past = shelf === "past";
  return (
    <section aria-labelledby={`${id}-heading`} className="min-w-0">
      <Glass className="flex flex-col gap-3 p-4">
        <h2 id={`${id}-heading`} className="text-xs font-bold tracking-[0.08em] text-muted-foreground uppercase">
          {heading}
        </h2>
        <ul
          className={cn(
            "grid grid-cols-2 gap-x-3 gap-y-5 md:grid-cols-4 md:gap-x-4",
            past && "max-md:-mx-4 max-md:flex max-md:snap-x max-md:snap-mandatory max-md:overflow-x-auto max-md:scroll-px-4 max-md:-mt-1 max-md:px-4 max-md:pt-1 max-md:pb-2",
          )}
        >
          {events.map((event) => (
            <li key={event.id} className={cn("min-w-0", past && "max-md:w-32 max-md:shrink-0 max-md:snap-start")}>
              <Link href={`/events/${event.id}`} className="group flex flex-col gap-1.5 rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                <PosterTile
                  theme={event.theme}
                  upload={pictureOf(event)}
                  title={event.title || t("untitled")}
                  sizes={past ? "(min-width: 48rem) 11rem, 8rem" : "(min-width: 48rem) 11rem, 45vw"}
                  chip={chipFor(tileChip(event), t)}
                  faded={past}
                  titleClassName={past ? "text-base" : undefined}
                  className="transition-transform group-hover:-translate-y-0.5"
                />
                <span className="text-sm font-semibold">
                  {whenKind(event) === "poll" ? t("datePoll") : isDated(event) ? formatWhenBrief(event, locale, { year: showsYear(event, now) }) : t("noDate")}
                </span>
                <TileNumber event={event} shelf={shelf} t={t} locale={locale} />
              </Link>
            </li>
          ))}
        </ul>
      </Glass>
    </section>
  );
}

// A chip sits on a poster, whose picture is not known, so its colours are fixed and opaque, never
// the glass the page's scope makes of the soft fills (globals.css, --chip).
function chipFor(chip: TileChip | null, t: Translate): ReactNode {
  if (!chip) return null;
  const pill = "rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold shadow-sm";
  if (chip.kind === "toApprove") return <span className={cn(pill, "bg-chip-attention text-chip-attention-ink")}>{t.rich("toApprove", { count: chip.count, n: (chunks) => chunks })}</span>;
  const label = chip.kind === "coHost" ? t("coHost") : chip.kind === "draft" ? t("draft") : t("cancelled");
  return <span className={cn(pill, chip.kind === "cancelled" ? "bg-chip-danger text-chip-danger-ink" : "bg-chip text-chip-ink")}>{label}</span>;
}

function TileNumber({ event, shelf, t, locale }: { event: ShelfEvent; shelf: "comingUp" | "drafts" | "past"; t: Translate; locale: string }) {
  const number = tileNumber(event, shelf);
  if (number.kind === "deletion")
    return <span className="text-xs font-semibold text-destructive">{t("deletedOn", { date: formatDay(number.date, event.timeZone, locale) })}</span>;
  const text =
    number.kind === "places"
      ? t("places", { count: number.headcount, capacity: number.capacity })
      : number.kind === "went"
        ? t("went", { count: number.count })
        : t.rich("going", { count: number.count, n: (chunks) => chunks });
  return <span className="text-sm text-muted-foreground">{text}</span>;
}
