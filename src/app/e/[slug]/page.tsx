import type { Metadata } from "next";
import { cache } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { listAnnouncements } from "@/announcements/repository";
import { getSession } from "@/auth/session";
import { mayDelete } from "@/comments/comment";
import { countComments, listComments } from "@/comments/repository";
import { commentsView, takesComments, type CommentsShown, type CommentViewer } from "@/comments/visibility";
import { PageFooter } from "@/components/page-footer";
import { TooFast } from "@/components/too-fast";
import { acceptsRsvps, eventPageFor } from "@/events/access";
import { eventHosts } from "@/events/hosts";
import { findEventBySlug, isRetiredSlug, type EventWithHost } from "@/events/repository";
import { baseUrl, maxUploadBytes } from "@/instance/env";
import { isSlug } from "@/events/slug";
import { ClientMessages } from "@/locale/client-messages";
import { answersStillOffered } from "@/questions/answers";
import { findAnswers, listQuestions } from "@/questions/repository";
import { asTally, countRsvps } from "@/rsvps/counts";
import { consume } from "@/rate-limit/rate-limit";
import { findRsvpOnThisDevice, guestRsvp } from "@/rsvps/guest";
import { listPublicGuestList } from "@/rsvps/repository";
import { guestListView } from "@/rsvps/visibility";
import { PosterLayout } from "@/themes/poster-layout";
import { resolveTheme } from "@/themes/resolve";
import { ThemedPage } from "@/themes/themed-page";
import { findEventUpload } from "@/uploads/repository";
import { themeUpload } from "@/uploads/uploads";
import { AddToCalendar } from "./add-to-calendar";
import { CancelledNotice } from "./cancelled-notice";
import { CommentForm } from "./comment-form";
import { DesignDrawer } from "./design-drawer";
import { RetiredLink } from "./retired-link";
import { DraftNotice } from "./draft-notice";
import { GuestList } from "./guest-list";
import { RsvpFlow } from "./rsvp-flow";
import { Countdown, MapLink, ViewerTime } from "./viewer";

// Event pages are never indexed (ADR-0004). The header carries the same signal (next.config.ts).
const noindex: Metadata["robots"] = { index: false, follow: false };

// Every host of the event, owner first: whom "Hosted by" names, and who sees a draft and the Design
// drawer. Cached per request, as the page and its redrawing both ask.
const hostsOf = cache(eventHosts);

async function isHostOf(eventId: string): Promise<boolean> {
  const session = await getSession();
  return session !== null && (await hostsOf(eventId)).some((host) => host.id === session.user.id);
}

// What the comments section shows this viewer, or nothing when the host has turned comments off:
// to the hosts and to a guest who has replied, the comments themselves; to anyone else only how
// many there are, so not one of them is sent to that browser.
async function commentsFor(event: EventWithHost, viewer: CommentViewer): Promise<CommentsShown | undefined> {
  if (!event.commentsEnabled) return undefined;
  if (commentsView(viewer) === "locked") return { view: "locked", count: await countComments(event.id) };
  const comments = await listComments(event.id);
  return {
    view: "open",
    canPost: takesComments(event, viewer),
    comments: comments.map(({ id, name, hostId, body, createdAt, rsvpId }) => ({
      id,
      name,
      byHost: hostId !== null,
      body,
      createdAt,
      deletable: mayDelete(viewer, { rsvpId }),
    })),
  };
}

// One of this page's own server actions (a guest's RSVP, the host's Design drawer) that changed
// something (revalidated, refreshed, or set a cookie) is answered with the page it was posted to,
// drawn again, whatever slug that page's address names. So such an action posted to an event link
// asks for that page as surely as a visit does, and would tell whether its slug exists. (Next.js
// hands any other action to a page it belongs to, which never draws this one.) The proxy lets
// actions through, as they are forms with limits and messages of their own (src/proxy.ts); the
// page counts its own redrawing instead, against the event page limit, for anyone but the event's
// hosts, whose Design drawer redraws it at every change. Past the limit it is drawn as "too fast"
// whatever the slug. Cached, so the page and its metadata count once.
const redrawAllowed = cache(async (slug: string): Promise<boolean> => {
  const requestHeaders = await headers();
  if (!requestHeaders.has("next-action")) return true;
  const event = isSlug(slug) ? await findEventBySlug(slug) : undefined;
  if (event && (await isHostOf(event.id))) return true;
  return (await consume("eventPage", requestHeaders)).allowed;
});

export async function generateMetadata({ params }: PageProps<"/e/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  if (!(await redrawAllowed(slug))) return { title: (await getTranslations("TooFast"))("title"), robots: noindex };
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
  if (!(await redrawAllowed(slug))) return <TooFast />;
  if (!isSlug(slug)) notFound();
  const event = await findEventBySlug(slug);
  if (!event) {
    if (await isRetiredSlug(slug)) return <RetiredLink />;
    notFound();
  }

  // Who is looking decides whether a draft shows at all, and whether the Design drawer is here.
  // A guest has no session cookie, and the lookup returns without touching the database.
  const isDraft = event.state === "draft";
  const isHost = await isHostOf(event.id);
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
  // A host comments as a host, even with an RSVP on this device; a guest under their RSVP's name.
  const viewer: CommentViewer = isHost ? { kind: "host" } : mine ? { kind: "guest", rsvpId: mine.rsvp.id } : { kind: "visitor" };
  // What this event asks, what this guest has already said, so coming back prefills, the host's
  // own picture if there is one, what the host has announced, which every viewer reads, and the
  // comments as this viewer may see them.
  const [questions, answers, upload, announcements, hosts, comments] = await Promise.all([
    listQuestions(event.id),
    mine ? findAnswers(mine.rsvp.id) : Promise.resolve({}),
    findEventUpload(event.id),
    listAnnouncements(event.id),
    hostsOf(event.id),
    commentsFor(event, viewer),
  ]);

  // Guests are sent the host's picture only while the page shows it: one the host put aside
  // stays in the host's gallery, not in anyone else's hands.
  const picture = upload ? themeUpload(upload) : null;
  const shown = resolveTheme(event.theme, picture).upload !== null;

  // The client components below read their messages in the browser; the host's Design drawer, only
  // on the host's own page, brings its own.
  return (
    <ClientMessages namespaces={["EventPage", "Rsvp"]}>
      <ThemedPage
        theme={event.theme}
        upload={isHost || shown ? picture : null}
        designer={
          isHost ? (
            <ClientMessages namespaces={["DesignDrawer"]}>
              <DesignDrawer eventId={event.id} title={event.title} maxUploadBytes={maxUploadBytes()} />
            </ClientMessages>
          ) : undefined
        }
      >
        <PosterLayout
          event={event}
          hosts={hosts.map((host) => host.name)}
          announcements={announcements}
          comments={comments}
          commentForm={<CommentForm slug={event.slug} />}
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
        <PageFooter themed />
      </ThemedPage>
    </ClientMessages>
  );
}
