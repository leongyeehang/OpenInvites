import type { Metadata } from "next";
import { cache } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { listAnnouncements } from "@/announcements/repository";
import { getSession } from "@/auth/session";
import { PageFooter } from "@/components/page-footer";
import { TooFast } from "@/components/too-fast";
import { acceptsRsvps } from "@/events/access";
import { hostsOf, isHostOf } from "@/events/hosts";
import { findEventBySlug, findRetiredSlug, recordView } from "@/events/repository";
import { countsAsView } from "@/events/views";
import { eventPath, eventUrl, isSlug } from "@/events/slug";
import { isDated, type EventTime } from "@/events/time";
import { deviceInvite, findInviteOnThisDevice } from "@/invites/device";
import { gateFor } from "@/invites/gate";
import { letterFor } from "@/invites/invite";
import { isMailConfigured } from "@/mail/config";
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
import { LockedPage } from "./locked-page";
import { NotReady } from "./not-ready";
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
import type { CommentViewer } from "@/comments/visibility";
import { parseArrangement, sectionOn } from "@/sections";
import { loadSections, readySections, type SectionPage } from "@/themes/sections/drawings";

// Event pages are never indexed (ADR-0004). The header carries the same signal (next.config.ts).
const noindex: Metadata["robots"] = { index: false, follow: false };

// One of this page's own server actions (a guest's RSVP, a comment) that changed
// something (revalidated, refreshed, or set a cookie) is answered with the page it was posted to,
// drawn again, whatever slug that page's address names. So such an action posted to an event link
// asks for that page as surely as a visit does, and would tell whether its slug exists. (Next.js
// hands any other action to a page it belongs to, which never draws this one.) The proxy lets
// actions through, as they are forms with limits and messages of their own (src/proxy.ts); the
// page counts its own redrawing instead, against the event page limit, for anyone but the event's
// hosts, whose own changes redraw it. Past the limit it is drawn as "too fast"
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
  // A draft unfurls as nothing: its title is not public until the host says so. Nor does an
  // invite-only event to anyone not in (M6 spec, "What the lock covers").
  if (event.state === "draft") return { title: t("notReadyTitle"), robots: noindex };
  // An invite-only event never unfurls, even for those in: a card is drawn for whoever fetches the
  // link, and its picture is cached publicly (preview.png). Its title is "You're invited" to all
  // but its hosts, those let in too (M6 final review), so the title never tells whether a device
  // is in, and the event's own title stays inside the page.
  if (event.inviteOnly) return { title: (await gateFor(event)).isHost ? event.title : t("lockedTitle"), robots: noindex };

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
// its own presentation of it.
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

  // Who is looking decides whether a draft shows at all, whether an invite-only event opens to them
  // (invites/gate.ts), and whose comments and album these are.
  const isDraft = event.state === "draft";
  const { isHost, page, invite: standsFor } = await gateFor(found);
  if (page === "notReady") return <NotReady />;
  // Nothing of the event but its host's name, and a way in for the invited (M6 spec, "The locked
  // page"): the email of the invite whose link this device opened is filled in.
  if (page === "locked") return <LockedPage slug={event.slug} host={event.hostName} email={standsFor?.email ?? null} mail={isMailConfigured()} />;

  // This is the one place a page render writes. A server action redraw is a POST naming its
  // action, which is all the page can tell of the method.
  const requestHeaders = await headers();
  const method = requestHeaders.has("next-action") ? "POST" : "GET";
  if (countsAsView({ method, headers: requestHeaders }, event, { isHost })) await recordView(event.id);

  const locale = await getLocale();
  const link = eventUrl(event);
  // The one moment this page is drawn at, for everything on it that depends on the time.
  const now = new Date();
  // The cookie tells us whether the guest in front of us has already replied on this device; if
  // not, whether they opened a personal invite to the event, whose name and email their answer
  // starts from (invites/device.ts).
  const mine = await findRsvpOnThisDevice(event.id);
  const invite = mine ? undefined : await findInviteOnThisDevice(event.id);
  // The host's letter to the guest this device stands for (M6 ticket 09), on any event with
  // personal letters on, invite-only or not: the letter of the invite the device's pass, its invite
  // cookie or the reply it holds is for (invites/device.ts). It is shown to whoever's device stands
  // for an invite with a letter, a host too, so a host who opens a guest's personal link sees what
  // that guest sees. Asked for only while letters are on, so an event without them pays nothing,
  // and only when the gate has not already found the invite, as it does on an invite-only event
  // for anyone who does not host it. Never in the page's metadata, its preview card or its
  // calendar file: on this page alone.
  const letter = event.lettersEnabled ? letterFor(event, standsFor ?? (await deviceInvite(event.id, mine)).invite) : undefined;
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
  // How the host arranged the page's sections (M8 ticket 25): a section switched off there is not
  // even read (ticket 27).
  const arrangement = parseArrangement(event.sections);
  // What this event asks, what this guest has already said, so coming back prefills, the host's
  // own picture if there is one, and what the host has announced, which every viewer reads.
  // Whether the event is full is said beside the reply controls whatever the guest list shows, so
  // the headcount is counted apart from it; and a guest on the waitlist is told their place.
  const [questions, answers, upload, announcements, hosts, headcount, waitlistPosition] = await Promise.all([
    listQuestions(event.id),
    mine ? findAnswers(mine.rsvp.id) : Promise.resolve({}),
    findEventUpload(event.id),
    sectionOn(arrangement, "announcements") ? listAnnouncements(event.id) : Promise.resolve([]),
    hostsOf(event.id),
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
    // The invite's email and phone only where the form asks for them: nothing would show them
    // otherwise. A voter gave no phone.
    invite: (invite ?? voter) && {
      name: (invite ?? voter)!.name,
      email: event.emailField === "none" ? null : (invite ?? voter)!.email,
      phone: event.phoneField === "none" ? null : (invite?.phone ?? null),
    },
    open: acceptsRsvps(event.state),
    full: isFull(event.capacity, headcount),
    needsApproval: event.approvalRequired && (mine ? mine.rsvp.approval !== "approved" : !invite),
    questions,
    answers: answersStillOffered(answers, questions),
    calendar,
    turnstileSiteKey: turnstileSiteKey(),
  };
  // A guest whose reply is not approved is told why the list is locked for them.
  // The Broadsheet and the Thread mark the viewer's own line.
  const guestList = view === "hidden" ? undefined : { view, guests, counts: countRsvps(guests.map(asTally)), approval: mine?.rsvp.approval, you: mine?.rsvp.id };

  // The page's sections (M8 ticket 25; themes/sections/drawings.ts), each loaded by its own drawing
  // from what the page has worked out: the schedule (M6 ticket 02), the comments as this viewer may
  // see them, with who they react as, and the photo album (M4 ticket 11), from the start, to the
  // hosts and to the guests the host chose (M6 ticket 03).
  const sectionPage: SectionPage = {
    event,
    layout,
    locale,
    now,
    isHost,
    letter,
    guestList,
    announcements,
    commentViewer: viewer,
    reactor: isHost ? { hostId: (await getSession())!.user.id } : mine ? { rsvpId: mine.rsvp.id } : undefined,
    commentForm: <CommentForm slug={event.slug} />,
    details: {
      underWhen: time && (
        <>
          <ViewerTime event={time} locale={locale} />
          <Countdown event={time} />
        </>
      ),
      // The Thread's maps link is one of its bubbles' chips.
      underWhere: event.location ? <MapLink location={event.location} chip={layout === "thread"} /> : undefined,
      calendar,
      poll: polling ? <PollWhen candidates={candidates} /> : undefined,
    },
  };
  // Every layout draws the same sections, loaded once, in the host's order (M8 ticket 27).
  const sections = await readySections(sectionPage, await loadSections(sectionPage, arrangement), arrangement);
  // How many have replied, and the headcount, are numbers the guest list gives away only with it.
  const open = guestList?.view === "open" ? guestList.counts : undefined;

  // The client components below read their messages in the browser.
  return (
    <ClientMessages namespaces={["EventPage", "Rsvp", "Turnstile", "Voting"]}>
      <ThemedPage
        // A picture the host put aside is sent to nobody but the host, whose Poster sheet works
        // with it (spec, "Events, guests and the page").
        theme={event.theme}
        upload={isHost ? picture : resolved.upload}
      >
        {layout === "thread" && dated && time ? (
          <ThreadLayout
            event={dated}
            hosts={hosts.map((host) => host.name)}
            notice={notice}
            rsvp={<ThreadComposer {...flow} closedAs={isDraft ? "draft" : event.state === "cancelled" ? "cancelled" : undefined} />}
            replies={open && open.going + open.maybe + open.cant}
            sections={sections}
          />
        ) : layout === "broadsheet" && dated && time ? (
          <BroadsheetLayout
            event={dated}
            hosts={hosts.map((host) => host.name)}
            notice={notice}
            rsvp={<BroadsheetBallot {...flow} />}
            underWhen={<ViewerTime event={time} locale={locale} />}
            countdown={<CountdownFigure event={time} />}
            underWhere={event.location ? <MapLink location={event.location} /> : undefined}
            headcount={open?.headcount}
            sections={sections}
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
              notice={notice}
              rsvp={polling ? <PollBar /> : <RsvpFlow {...flow} />}
              poll={polling ? { label: (await getTranslations("EventPage"))("poll.toBeDecided") } : undefined}
              sections={sections}
            />
          </PollFrame>
        )}
        <PageFooter themed reportPath={isDraft ? undefined : eventPath(event)} />
      </ThemedPage>
    </ClientMessages>
  );
}
