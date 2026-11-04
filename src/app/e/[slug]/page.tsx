import type { Metadata } from "next";
import { cache } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { listAnnouncements } from "@/announcements/repository";
import { getSession } from "@/auth/session";
import { mayDelete } from "@/comments/comment";
import { reactionsByComment, type Reactor } from "@/comments/reactions";
import { countComments, listComments, listReactions } from "@/comments/repository";
import { commentsView, takesComments, type CommentsShown, type CommentViewer } from "@/comments/visibility";
import { PageFooter } from "@/components/page-footer";
import { TooFast } from "@/components/too-fast";
import { acceptsRsvps, eventPageFor } from "@/events/access";
import { eventHosts } from "@/events/hosts";
import { findEventBySlug, findRetiredSlug, recordView, type EventWithHost } from "@/events/repository";
import { countsAsView } from "@/events/views";
import { eventPath, eventUrl, isSlug } from "@/events/slug";
import { formatDay, isDated, type EventTime } from "@/events/time";
import { findInviteOnThisDevice } from "@/invites/device";
import { ClientMessages } from "@/locale/client-messages";
import { answersStillOffered } from "@/questions/answers";
import { findAnswers, listQuestions } from "@/questions/repository";
import { asTally, countRsvps } from "@/rsvps/counts";
import { consume } from "@/rate-limit/rate-limit";
import { isFull } from "@/rsvps/admission";
import { findRsvpOnThisDevice, guestRsvp } from "@/rsvps/guest";
import { countHeadcount, findWaitlistPosition, listPublicGuestList } from "@/rsvps/repository";
import { guestListView } from "@/rsvps/visibility";
import { BroadsheetLayout } from "@/themes/broadsheet-layout";
import { PosterLayout } from "@/themes/poster-layout";
import { resolveTheme } from "@/themes/resolve";
import { ThemedPage } from "@/themes/themed-page";
import { ThreadLayout } from "@/themes/thread-layout";
import { turnstileSiteKey } from "@/turnstile/config";
import { findEventUpload } from "@/uploads/repository";
import { themeUpload } from "@/uploads/uploads";
import { AddToCalendar } from "./add-to-calendar";
import { BroadsheetBallot } from "./broadsheet-ballot";
import { CancelledNotice } from "./cancelled-notice";
import { CommentForm } from "./comment-form";
import { RetiredLink } from "./retired-link";
import { DraftNotice } from "./draft-notice";
import { GuestList } from "./guest-list";
import { RsvpFlow } from "./rsvp-flow";
import { ThreadComposer } from "./thread-composer";
import type { RsvpFlowProps } from "./use-rsvp-flow";
import { Countdown, CountdownFigure, MapLink, ViewerTime } from "./viewer";
import type { ComponentProps, ReactNode } from "react";
import { formatOption } from "@/polls/format";
import { mayVote, pollState, tally } from "@/polls/poll";
import { loadPoll } from "@/polls/repository";
import { findVoterOnThisDevice } from "@/polls/voter";
import { PollBar, PollFlow, PollWhen, type PollCandidate } from "./poll-flow";
import { albumState, mayDeletePhoto, mayUseAlbum, type AlbumViewer } from "@/album/album";
import { photoUrl } from "@/album/files";
import { countPhotos, listPhotos } from "@/album/repository";
import { maxUploadBytes } from "@/instance/env";
import { AlbumSection, type AlbumShown } from "@/themes/sections/album-section";

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
// to the hosts and to a guest whose reply the host has approved, the comments themselves; to anyone
// else only how many there are, so not one of them is sent to that browser, and to a guest whose
// reply is not approved, why.
// Each comment carries its reactions, and whether this viewer gave each: `reactor` is who they react
// as, if they may (M4 ticket 04). Whoever may post may react.
async function commentsFor(event: EventWithHost, viewer: CommentViewer, reactor: Reactor | undefined): Promise<CommentsShown | undefined> {
  if (!event.commentsEnabled) return undefined;
  if (commentsView(viewer) === "locked") {
    return { view: "locked", count: await countComments(event.id), approval: viewer.kind === "guest" ? viewer.approval : undefined };
  }
  const [comments, reactions] = await Promise.all([listComments(event.id), listReactions(event.id)]);
  const grouped = reactionsByComment(reactions, reactor);
  const canPost = takesComments(event, viewer);
  return {
    view: "open",
    canPost,
    canReact: canPost,
    comments: comments.map(({ id, name, hostId, body, createdAt, rsvpId }) => ({
      reactions: grouped.get(id) ?? [],
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

// The candidates as guests see them: each as they read it, with how many said Yes.
async function pollCandidates(eventId: string, locale: string): Promise<PollCandidate[]> {
  const { options, voters, votes } = await loadPoll(eventId);
  const tallies = tally(options, votes, voters);
  return options.map((option, index) => ({ id: option.id, label: formatOption(option, locale), yes: tallies[index].yes.length }));
}

// What the album shows this viewer (album/album.ts), or nothing where there is no album.
async function albumFor(event: EventWithHost, viewer: AlbumViewer, locale: string): Promise<AlbumShown | undefined> {
  const state = albumState(event, new Date());
  if (state === "none" || !event.startsAt) return undefined;
  if (state === "notYet") return { view: "notYet", opensOn: formatDay(event.startsAt, event.timeZone, locale) };
  if (!mayUseAlbum(viewer)) return { view: "locked", count: await countPhotos(event.id) };
  const photos = await listPhotos(event.id);
  return {
    view: "open",
    maxMegabytes: Math.floor(maxUploadBytes() / (1024 * 1024)),
    photos: photos.map((each) => ({
      id: each.id,
      name: each.name,
      thumb: photoUrl(each.id, "thumb"),
      large: photoUrl(each.id, "large"),
      width: each.width,
      height: each.height,
      deletable: mayDeletePhoto(viewer, each),
    })),
  };
}

// The vote's sheet around the page, only while guests vote on the date.
function PollFrame({ polling, children, ...props }: { polling: boolean; children: ReactNode } & Omit<ComponentProps<typeof PollFlow>, "children">) {
  return polling ? <PollFlow {...props}>{children}</PollFlow> : children;
}

export async function generateMetadata({ params }: PageProps<"/e/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  if (!(await redrawAllowed(slug))) return { title: (await getTranslations("TooFast"))("title"), robots: noindex };
  const event = isSlug(slug) ? await findEventBySlug(slug) : undefined;
  const [t, notFound] = await Promise.all([getTranslations("EventPage"), getTranslations("NotFound")]);
  if (!event) {
    const retired = isSlug(slug) && (await findRetiredSlug(slug)) !== undefined;
    return { title: retired ? t("retiredTitle") : notFound("title"), robots: noindex };
  }
  // A draft unfurls as nothing: its title is not public until the host says so.
  if (eventPageFor(event.state, { isHost: false }) === "notReady") return { title: t("notReadyTitle"), robots: noindex };

  const link = eventUrl(event);
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
// first paint is the finished look, in the layout the theme names. Every layout shows the same things, and the guest's RSVP flow is one
// set of rules (use-rsvp-flow.ts) that each layout presents in its own way, so the page hands each
// its own presentation of it. The host also gets the Design drawer on their own page.
export default async function EventPage({ params }: PageProps<"/e/[slug]">) {
  const { slug } = await params;
  if (!(await redrawAllowed(slug))) return <TooFast />;
  if (!isSlug(slug)) notFound();
  const found = await findEventBySlug(slug);
  if (!found) {
    const retired = await findRetiredSlug(slug);
    if (retired) return <RetiredLink eventDeleted={retired.eventDeleted} />;
    notFound();
  }
  // Everything below hands the event to client components, which are sent whole. The slug it
  // carries is the one this page was opened at, so a page opened at the custom link never holds
  // the random link, the private one (ADR-0004).
  const event = { ...found, slug };

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

  // This is the one place a page render writes. A server action redraw is a POST naming its
  // action, which is all the page can tell of the method.
  const requestHeaders = await headers();
  const method = requestHeaders.has("next-action") ? "POST" : "GET";
  if (countsAsView({ method, headers: requestHeaders }, event, { isHost })) await recordView(event.id);

  const locale = await getLocale();
  const link = eventUrl(event);
  // The cookie tells us whether the guest in front of us has already replied on this device; if
  // not, whether they opened a personal invite to the event, whose name and email their answer
  // starts from (invites/device.ts).
  const mine = await findRsvpOnThisDevice(event.id);
  const invite = mine ? undefined : await findInviteOnThisDevice(event.id);
  // Whether this guest may see the list decides whether it is even loaded: a reply the host has not
  // approved opens nothing (rsvps/visibility.ts).
  const view = guestListView(event.guestListVisibility, { rsvp: mine?.rsvp });
  const guests = view === "open" ? await listPublicGuestList(event.id) : [];
  // A host comments as a host, even with an RSVP on this device; a guest under their RSVP's name,
  // once the host has approved it (comments/visibility.ts).
  const viewer: CommentViewer = isHost
    ? { kind: "host" }
    : mine
      ? { kind: "guest", rsvpId: mine.rsvp.id, approval: mine.rsvp.approval }
      : { kind: "visitor" };
  // What this event asks, what this guest has already said, so coming back prefills, the host's
  // own picture if there is one, what the host has announced, which every viewer reads, and the
  // comments as this viewer may see them.
  // Whether the event is full is said beside the reply controls whatever the guest list shows, so
  // the headcount is counted apart from it; and a guest on the waitlist is told their place.
  const [questions, answers, upload, announcements, hosts, comments, headcount, waitlistPosition] = await Promise.all([
    listQuestions(event.id),
    mine ? findAnswers(mine.rsvp.id) : Promise.resolve({}),
    findEventUpload(event.id),
    listAnnouncements(event.id),
    hostsOf(event.id),
    commentsFor(event, viewer, isHost ? { hostId: (await getSession())!.user.id } : mine ? { rsvpId: mine.rsvp.id } : undefined),
    event.capacity === null ? Promise.resolve(0) : countHeadcount(event.id),
    mine ? findWaitlistPosition(mine.rsvp) : Promise.resolve(null),
  ]);

  // Guests are sent the host's picture only while it is the poster: one the host put aside stays
  // with the host, not in anyone else's hands.
  const picture = upload ? themeUpload(upload) : null;
  const resolved = resolveTheme(event.theme, picture);
  // A draft with no date yet, which only its hosts see, is shown in the Poster layout, the one that
  // can go without a When; the others are drawn around their date.
  const dated = isDated(event) ? event : undefined;
  const layout = dated ? resolved.layout : "poster";
  // While guests vote on the date (M4 ticket 09), the Poster shows the candidates and the vote in
  // place of the date and the reply, whatever layout the theme names: the others are drawn around
  // a date. This device's votes come back, and once the date is picked, the voter's name and email
  // start their reply.
  const polling = pollState(event) === "open";
  const voter = await findVoterOnThisDevice(event.id);
  const candidates = polling ? await pollCandidates(event.id, locale) : [];
  // The photo album (M4 ticket 11): from the start, to the hosts and approved guests.
  const album = await albumFor(event, isHost ? { kind: "host", hostId: (await getSession())!.user.id } : mine ? { kind: "guest", rsvpId: mine.rsvp.id, approval: mine.rsvp.approval } : { kind: "visitor" }, locale);
  const albumNode = album && <AlbumSection album={album} slug={event.slug} />;
  // The same rule the file itself follows: there is nothing to put in a calendar until an event
  // is published, and nothing worth keeping there once it is called off.
  const calendar =
    dated && acceptsRsvps(event.state) ? <AddToCalendar event={dated} link={link} inCard={layout !== "thread"} chips={layout === "thread"} /> : undefined;

  const notice = isDraft ? <DraftNotice eventId={event.id} /> : event.state === "cancelled" ? <CancelledNotice /> : undefined;
  // The browser shows the time in the viewer's own zone and counts down to it, from the event's
  // time alone: a client component is sent all it is handed, and the event holds more than a guest
  // should be sent.
  const time: EventTime | undefined = dated && { startsAt: dated.startsAt, endsAt: dated.endsAt, allDay: dated.allDay, timeZone: dated.timeZone };
  const flow: RsvpFlowProps = {
    slug: event.slug,
    settings: {
      plusOnesAllowed: event.plusOnesAllowed,
      requirePlusOneNames: event.requirePlusOneNames,
      emailField: event.emailField,
      phoneField: event.phoneField,
    },
    mine: mine && guestRsvp(mine, waitlistPosition),
    // The invite's email only where the form asks for one: nothing would show it otherwise.
    invite: (invite ?? voter) && { name: (invite ?? voter)!.name, email: event.emailField === "none" ? null : (invite ?? voter)!.email },
    open: acceptsRsvps(event.state),
    full: isFull(event.capacity, headcount),
    needsApproval: event.approvalRequired && (mine ? mine.rsvp.approval !== "approved" : !invite),
    questions,
    answers: answersStillOffered(answers, questions),
    calendar,
    turnstileSiteKey: turnstileSiteKey(),
  };
  // A guest whose reply is not approved is told why the list is locked for them.
  const guestList = view === "hidden" ? undefined : { view, guests, counts: countRsvps(guests.map(asTally)), approval: mine?.rsvp.approval };

  // The client components below read their messages in the browser; the host's Design drawer, only
  // on the host's own page, brings its own.
  return (
    <ClientMessages namespaces={["EventPage", "Rsvp", "Turnstile"]}>
      <ThemedPage
        // A picture the host put aside is sent to nobody but the host, whose Design drawer works
        // with it (spec, "Events, guests and the page").
        theme={event.theme}
        upload={isHost ? picture : resolved.upload}
      >
        {layout === "thread" && dated && time ? (
          <ThreadLayout
            event={dated}
            hosts={hosts.map((host) => host.name)}
            announcements={announcements}
            comments={comments}
            commentForm={<CommentForm slug={event.slug} />}
            album={albumNode}
            notice={notice}
            rsvp={<ThreadComposer {...flow} closedAs={isDraft ? "draft" : event.state === "cancelled" ? "cancelled" : undefined} />}
            guests={guestList && { ...guestList, you: mine?.rsvp.id }}
            underWhen={
              <>
                <ViewerTime event={time} locale={locale} />
                <Countdown event={time} />
              </>
            }
            underWhere={event.location ? <MapLink location={event.location} chip /> : undefined}
          />
        ) : layout === "broadsheet" && dated && time ? (
          <BroadsheetLayout
            event={dated}
            hosts={hosts.map((host) => host.name)}
            announcements={announcements}
            comments={comments}
            commentForm={<CommentForm slug={event.slug} />}
            album={albumNode}
            notice={notice}
            rsvp={<BroadsheetBallot {...flow} />}
            guests={guestList && { ...guestList, you: mine?.rsvp.id }}
            underWhen={<ViewerTime event={time} locale={locale} />}
            countdown={<CountdownFigure event={time} />}
            underWhere={event.location ? <MapLink location={event.location} /> : undefined}
          />
        ) : (
          <PollFrame
            polling={polling}
            slug={event.slug}
            candidates={candidates}
            mine={voter && { name: voter.name, email: voter.email, votes: voter.votes, editLink: voter.editLink }}
            votable={mayVote(event)}
            turnstileSiteKey={turnstileSiteKey()}
          >
            <PosterLayout
              event={event}
              hosts={hosts.map((host) => host.name)}
              announcements={announcements}
              comments={comments}
              commentForm={<CommentForm slug={event.slug} />}
              album={albumNode}
              notice={notice}
              rsvp={polling ? <PollBar /> : <RsvpFlow {...flow} />}
              poll={polling ? { label: (await getTranslations("EventPage"))("poll.toBeDecided"), when: <PollWhen candidates={candidates} /> } : undefined}
              underWhen={
                time && (
                  <>
                    <ViewerTime event={time} locale={locale} />
                    <Countdown event={time} />
                  </>
                )
              }
              underWhere={event.location ? <MapLink location={event.location} /> : undefined}
              calendar={calendar}
              guestList={guestList && <GuestList {...guestList} />}
            />
          </PollFrame>
        )}
        <PageFooter themed reportPath={isDraft ? undefined : eventPath(event)} />
      </ThemedPage>
    </ClientMessages>
  );
}
