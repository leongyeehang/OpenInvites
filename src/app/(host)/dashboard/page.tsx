import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import type { ReactNode } from "react";
import { requireHost } from "@/auth/session";
import { glowEvent, shelve, showsYear, tileChip, tileNumber, whenKind, type ShelfEvent, type TileChip } from "@/dashboard/shelves";
import { eventsOwnedAtLimit } from "@/events/limit";
import { listHostEvents } from "@/events/repository";
import { formatDay, formatWhen, formatWhenBrief, isDated } from "@/events/time";
import type { Limits } from "@/instance/limits";
import { homeTheme, pickPoster, posterPool } from "@/instance/home";
import { homePage, instanceLimits, operatorToWelcome, registrationMode } from "@/instance/repository";
import { cn } from "@/lib/utils";
import { ClientMessages } from "@/locale/client-messages";
import { retentionFloorDays } from "@/retention/floor";
import { deletionDate } from "@/retention/plan";
import { NO_RSVPS } from "@/rsvps/counts";
import { countRsvpsByEvent } from "@/rsvps/repository";
import { PosterTile } from "@/themes/poster-tile";
import { LONG_TITLE } from "@/themes/title-fonts";
import { findGalleryPoster } from "@/themes/posters";
import { resolveTheme, type ThemeUpload } from "@/themes/resolve";
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
// its poster under Coming up, Drafts and Past, on a glow taken from a poster. Which event goes where
// is shelves.ts's to say; this page only draws it. A new operator is first welcomed on it, once.
export default async function DashboardPage() {
  const host = await requireHost();
  const [t, locale, events, limits, welcome, atLimit] = await Promise.all([
    getTranslations("Host.dashboard"),
    getLocale(),
    listHostEvents(host.id),
    instanceLimits(),
    operatorToWelcome(host.id),
    eventsOwnedAtLimit(host.id),
  ]);
  const ids = events.map((event) => event.id);
  const [counts, uploads] = await Promise.all([
    countRsvpsByEvent(ids),
    findEventUploads(events.filter((event) => event.theme.poster.kind === "upload").map((event) => event.id)),
  ]);
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
  const first = events.length === 0 ? homeTheme(pickPoster(posterPool(await homePage()))) : null;
  const glow = glowEvent(shelves);
  const tile = { t, locale, now };

  return (
    <div data-slot="dashboard" className="flex flex-col gap-8">
      <Glow theme={glow?.theme ?? first} upload={glow ? pictureOf(glow) : null} />
      {welcome && <Welcome limits={limits} />}
      <div className="flex flex-col gap-2">
        <h1 tabIndex={-1} className="text-3xl font-bold tracking-tight outline-none">
          {t("title")}
        </h1>
        {atLimit !== undefined && <p className="text-sm text-muted-foreground">{t("limitReached", { count: atLimit })}</p>}
      </div>
      {first && <FirstInvitation theme={first} t={t} />}
      {shelves.nextUp && <NextUp event={shelves.nextUp} upload={pictureOf(shelves.nextUp)} t={t} locale={locale} />}
      <Shelf id="coming-up" heading={t("comingUp")} events={shelves.comingUp} shelf="comingUp" pictureOf={pictureOf} {...tile} />
      <Shelf id="drafts" heading={t("drafts")} events={shelves.drafts} shelf="drafts" pictureOf={pictureOf} {...tile} />
      <Shelf id="past" heading={t("past")} events={shelves.past} shelf="past" pictureOf={pictureOf} {...tile} />
    </div>
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

// Behind the top of the page, the blurred copy of a poster fading into the ground, as an event page
// is painted with its poster's copy; a colour poster lends a faint wash of its gradient instead. It
// is placed against the page itself, so it spans the screen under the header, and it never moves.
// A dark copy is laid on faintly and a light one more strongly, so the header, the heading and the
// shelves' grey labels keep 4.5:1 over it (the final review measured 2.3:1 under Disco at 60%).
function Glow({ theme, upload }: { theme: Theme | null; upload: ThemeUpload | null }) {
  if (!theme) return null;
  const { background } = resolveTheme(theme, upload);
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[30rem] overflow-hidden [mask-image:linear-gradient(#000_25%,transparent)]">
      {background.kind === "photo" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={background.src}
          alt=""
          className="size-full scale-110 object-cover blur-3xl saturate-150"
          style={{ opacity: Math.min(0.55, 0.12 + background.luminance * 0.45) }}
        />
      ) : (
        <div className="size-full opacity-35" style={{ background: background.css }} />
      )}
    </div>
  );
}

function FirstInvitation({ theme, t }: { theme: Theme; t: Translate }) {
  return (
    <section aria-labelledby="first-heading" className="grid gap-5 rounded-3xl bg-card p-3 shadow-sm ring-1 ring-foreground/5 sm:grid-cols-[14rem_1fr] sm:items-center">
      <PosterTile theme={theme} upload={null} sizes="14rem" priority className="max-sm:mx-auto max-sm:max-w-60" />
      <div className="flex flex-col items-start gap-3 px-2 pb-3 sm:pb-0">
        <h2 id="first-heading" className="text-2xl font-bold tracking-tight text-balance">
          {t("firstTitle")}
        </h2>
        <p className="text-muted-foreground">{t("firstText")}</p>
        <Link
          href="/events/new"
          className="mt-1 inline-flex h-10 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground outline-none hover:bg-primary/85 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {t("firstButton")}
        </Link>
      </div>
    </section>
  );
}

const button = "inline-flex h-10 flex-1 items-center justify-center rounded-full px-4 text-sm font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

// The next event: its poster, when it is, how its replies stand and what needs the host, and the
// three pages a host goes to most. On a phone the poster is above; from md it is beside, and the
// replies become large figures.
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
    <section aria-labelledby="next-up-heading" className="flex flex-col gap-3">
      <h2 id="next-up-heading" className="text-xs font-bold tracking-[0.08em] text-muted-foreground uppercase">
        {t("nextUp")}
      </h2>
      <div className="grid gap-4 rounded-3xl bg-card p-2 shadow-lg shadow-foreground/5 ring-1 ring-foreground/5 md:grid-cols-[18rem_1fr] md:gap-7 md:p-3">
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
            <Link href={`/events/${event.id}/guests`} className={cn(button, "bg-primary text-primary-foreground hover:bg-primary/85")}>
              {t("guests")}
            </Link>
            <Link href={`/events/${event.id}`} className={cn(button, "bg-secondary text-secondary-foreground hover:bg-muted")}>
              {t("edit")}
            </Link>
            <Link href={`/events/${event.id}/share`} className={cn(button, "bg-secondary text-secondary-foreground hover:bg-muted")}>
              {t("share")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// A shelf of tiles, drawn only when it has events: two across on a phone and four from md, except
// Past, which on a phone is one row that scrolls sideways inside itself, its posters faded.
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
    <section aria-labelledby={`${id}-heading`} className="flex min-w-0 flex-col gap-3">
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
    </section>
  );
}

function chipFor(chip: TileChip | null, t: Translate): ReactNode {
  if (!chip) return null;
  const pill = "rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold shadow-sm";
  if (chip.kind === "toApprove") return <span className={cn(pill, "bg-attention-soft text-attention")}>{t.rich("toApprove", { count: chip.count, n: (chunks) => chunks })}</span>;
  const label = chip.kind === "coHost" ? t("coHost") : chip.kind === "draft" ? t("draft") : t("cancelled");
  return <span className={cn(pill, chip.kind === "cancelled" ? "bg-destructive-soft text-destructive" : "bg-card/90 text-foreground")}>{label}</span>;
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
