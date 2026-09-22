import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { getSession } from "@/auth/session";
import { acceptsRsvps, eventPageFor } from "@/events/access";
import { findEventBySlug } from "@/events/repository";
import { isSlug } from "@/events/slug";
import { answersStillOffered } from "@/questions/answers";
import { findAnswers, listQuestions } from "@/questions/repository";
import { asTally, countRsvps } from "@/rsvps/counts";
import { findRsvpOnThisDevice, guestRsvp } from "@/rsvps/guest";
import { listPublicGuestList } from "@/rsvps/repository";
import { guestListView } from "@/rsvps/visibility";
import { PosterLayout } from "@/themes/poster-layout";
import { resolveTheme } from "@/themes/resolve";
import { ThemedPage } from "@/themes/themed-page";
import { CancelledNotice } from "./cancelled-notice";
import { DraftNotice } from "./draft-notice";
import { GuestList } from "./guest-list";
import { RsvpFlow } from "./rsvp-flow";

// Event pages are never indexed (ADR-0004). The header carries the same signal (next.config.ts).
const noindex: Metadata["robots"] = { index: false, follow: false };

export async function generateMetadata({ params }: PageProps<"/e/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const event = isSlug(slug) ? await findEventBySlug(slug) : undefined;
  const [t, notFound] = await Promise.all([getTranslations("EventPage"), getTranslations("NotFound")]);
  const title = !event ? notFound("title") : event.state === "published" ? event.title : t("notReadyTitle");
  return { title, robots: noindex };
}

// The event page: the invitation itself, rendered on the server in the event's theme so the
// first paint is the finished look. M1 ships the Poster layout; resolveTheme maps every stored
// layout to it.
export default async function EventPage({ params }: PageProps<"/e/[slug]">) {
  const { slug } = await params;
  if (!isSlug(slug)) notFound();
  const event = await findEventBySlug(slug);
  if (!event) notFound();

  // Only a draft needs to know who is looking, so only a draft pays for the session lookup.
  const isDraft = event.state === "draft";
  const isHost = isDraft && (await getSession())?.user.id === event.hostId;
  if (eventPageFor(event.state, { isHost }) === "notReady") {
    const t = await getTranslations("EventPage");
    return (
      <main className="mx-auto flex min-h-svh w-full max-w-xl flex-col justify-center gap-3 px-4 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">{t("notReadyTitle")}</h1>
        <p className="text-muted-foreground">{t("notReady")}</p>
      </main>
    );
  }

  const theme = resolveTheme(event.theme);
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
    <ThemedPage theme={theme}>
      <PosterLayout
        event={event}
        theme={theme}
        notice={isDraft ? <DraftNotice eventId={event.id} /> : event.state === "cancelled" ? <CancelledNotice /> : undefined}
        rsvp={
          <RsvpFlow
            slug={event.slug}
            settings={event}
            mine={mine && guestRsvp(mine)}
            buttonStyle={theme.buttonStyle}
            open={acceptsRsvps(event.state)}
            questions={questions}
            answers={answersStillOffered(answers, questions)}
          />
        }
        guestList={
          view === "hidden" ? undefined : <GuestList view={view} guests={guests} counts={countRsvps(guests.map(asTally))} />
        }
      />
    </ThemedPage>
  );
}
