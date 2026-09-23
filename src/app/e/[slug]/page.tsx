import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { getSession } from "@/auth/session";
import { acceptsRsvps, eventPageFor } from "@/events/access";
import { findEventBySlug, isRetiredSlug } from "@/events/repository";
import { baseUrl } from "@/instance/env";
import { isSlug } from "@/events/slug";
import { answersStillOffered } from "@/questions/answers";
import { findAnswers, listQuestions } from "@/questions/repository";
import { asTally, countRsvps } from "@/rsvps/counts";
import { findRsvpOnThisDevice, guestRsvp } from "@/rsvps/guest";
import { listPublicGuestList } from "@/rsvps/repository";
import { guestListView } from "@/rsvps/visibility";
import { PosterLayout } from "@/themes/poster-layout";
import { ThemedPage } from "@/themes/themed-page";
import { AddToCalendar } from "./add-to-calendar";
import { CancelledNotice } from "./cancelled-notice";
import { DesignDrawer } from "./design-drawer";
import { RetiredLink } from "./retired-link";
import { DraftNotice } from "./draft-notice";
import { GuestList } from "./guest-list";
import { RsvpFlow } from "./rsvp-flow";
import { Countdown, MapLink, ViewerTime } from "./viewer";

// Event pages are never indexed (ADR-0004). The header carries the same signal (next.config.ts).
const noindex: Metadata["robots"] = { index: false, follow: false };

export async function generateMetadata({ params }: PageProps<"/e/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const event = isSlug(slug) ? await findEventBySlug(slug) : undefined;
  const [t, notFound] = await Promise.all([getTranslations("EventPage"), getTranslations("NotFound")]);
  if (!event) {
    const retired = isSlug(slug) && (await isRetiredSlug(slug));
    return { title: retired ? t("retiredTitle") : notFound("title"), robots: noindex };
  }
  // A draft unfurls as nothing: its title is not public until the host says so.
  if (eventPageFor(event.state, { isHost: false }) === "notReady") return { title: t("notReadyTitle"), robots: noindex };

  const link = `${baseUrl()}/e/${event.slug}`;
  // The version in the URL is what makes the card change when the event or its theme does,
  // while each version stays cacheable forever.
  const preview = `${link}/preview.png?v=${event.updatedAt.getTime()}`;
  return {
    title: event.title,
    robots: noindex,
    openGraph: {
      type: "website",
      url: link,
      title: event.title,
      description: event.description || undefined,
      images: [{ url: preview, width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", title: event.title, images: [preview] },
  };
}

// The event page: the invitation itself, rendered on the server in the event's theme so the
// first paint is the finished look. M1 ships the Poster layout; resolveTheme maps every stored
// layout to it. The host also gets the Design drawer on their own page.
export default async function EventPage({ params }: PageProps<"/e/[slug]">) {
  const { slug } = await params;
  if (!isSlug(slug)) notFound();
  const event = await findEventBySlug(slug);
  if (!event) {
    if (await isRetiredSlug(slug)) return <RetiredLink />;
    notFound();
  }

  // Who is looking decides whether a draft shows at all, and whether the Design drawer is here.
  // A guest has no session cookie, and the lookup returns without touching the database.
  const isDraft = event.state === "draft";
  const isHost = (await getSession())?.user.id === event.hostId;
  if (eventPageFor(event.state, { isHost }) === "notReady") {
    const t = await getTranslations("EventPage");
    return (
      <main className="mx-auto flex min-h-svh w-full max-w-xl flex-col justify-center gap-3 px-4 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">{t("notReadyTitle")}</h1>
        <p className="text-muted-foreground">{t("notReady")}</p>
      </main>
    );
  }

  const locale = await getLocale();
  const link = `${baseUrl()}/e/${event.slug}`;
  // The same rule the file itself follows: there is nothing to put in a calendar until an event
  // is published, and nothing worth keeping there once it is called off.
  const calendar = acceptsRsvps(event.state) ? <AddToCalendar event={event} link={link} /> : undefined;
  // The cookie tells us whether the guest in front of us has already replied on this device.
  const mine = await findRsvpOnThisDevice(event.id);
  // Whether this guest may see the list decides whether it is even loaded.
  const view = guestListView(event.guestListVisibility, { hasRsvp: mine !== undefined });
  const guests = view === "open" ? await listPublicGuestList(event.id) : [];
  // What this event asks, and what this guest has already said, so coming back prefills.
  const [questions, answers] = await Promise.all([
    listQuestions(event.id),
    mine ? findAnswers(mine.rsvp.id) : Promise.resolve({}),
  ]);

  return (
    <ThemedPage theme={event.theme} designer={isHost ? <DesignDrawer eventId={event.id} title={event.title} /> : undefined}>
      <PosterLayout
        event={event}
        notice={isDraft ? <DraftNotice eventId={event.id} /> : event.state === "cancelled" ? <CancelledNotice /> : undefined}
        rsvp={
          <RsvpFlow
            slug={event.slug}
            settings={event}
            mine={mine && guestRsvp(mine)}
            open={acceptsRsvps(event.state)}
            questions={questions}
            answers={answersStillOffered(answers, questions)}
            calendar={calendar}
          />
        }
        underWhen={
          <>
            <ViewerTime event={event} locale={locale} />
            <Countdown event={event} />
          </>
        }
        underWhere={event.location ? <MapLink location={event.location} /> : undefined}
        calendar={calendar}
        guestList={
          view === "hidden" ? undefined : <GuestList view={view} guests={guests} counts={countRsvps(guests.map(asTally))} />
        }
      />
    </ThemedPage>
  );
}
