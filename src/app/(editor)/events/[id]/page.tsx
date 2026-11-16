import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireHost } from "@/auth/session";
import { PageFooter } from "@/components/page-footer";
import { ArrangeSheet } from "@/editor/arrange-sheet";
import { DesignSheets } from "@/editor/design-sheets";
import { EditorDetails, type EditableDetails } from "@/editor/details";
import { EditableTitle } from "@/editor/editable-title";
import { LinksSheet } from "@/editor/links-sheet";
import { NoteSheet } from "@/editor/note-sheet";
import { defaultHeadings, previewSections } from "@/editor/section-previews";
import { SettingsSheet, EditorToolbar } from "@/editor/settings-sheet";
import { EditorProvider } from "@/editor/status";
import { EditorTopBar } from "@/editor/top-bar";
import { eventHosts } from "@/events/hosts";
import { findHostEvent } from "@/events/repository";
import { featureOn, siteFeatures } from "@/features";
import { eventUrl } from "@/events/slug";
import { formatDay, formatWhen, isDated, timeZones, toWallTime } from "@/events/time";
import { can } from "@/hosts/role";
import { AlbumReminderNotice } from "@/album/album-reminder-notice";
import { ffmpegStatus } from "@/album/ffmpeg";
import { albumTotals } from "@/album/repository";
import { instanceLimits } from "@/instance/repository";
import { MEGABYTE } from "@/lib/sizes";
import { ClientMessages } from "@/locale/client-messages";
import { isMailConfigured } from "@/mail/config";
import { countAnswersByQuestion, listQuestions } from "@/questions/repository";
import { retentionFloorDays } from "@/retention/floor";
import { deletionDate } from "@/retention/plan";
import { countRsvpsByEvent } from "@/rsvps/repository";
import { PosterLayout } from "@/themes/poster-layout";
import { ThemedPage } from "@/themes/themed-page";
import { findEventUpload } from "@/uploads/repository";
import { themeUpload } from "@/uploads/uploads";
import type { EditablePoll } from "@/editor/poll-sheet";
import { formatOption } from "@/polls/format";
import { leading, pollState, tally } from "@/polls/poll";
import { loadPoll } from "@/polls/repository";
import { listSchedule } from "@/schedule/repository";
import { parseArrangement, sectionKey, type Switches } from "@/sections";
import { VotingSettings } from "@/voting";

// The poll as the When sheet shows it: each candidate as typed and as read, with its votes by name.
async function editablePoll(eventId: string, open: boolean, canStart: boolean, locale: string): Promise<EditablePoll> {
  const { options, voters, votes } = await loadPoll(eventId);
  const tallies = tally(options, votes, voters);
  const lead = new Set(leading(tallies));
  return {
    open,
    canStart,
    voters: voters.length,
    options: options.map((option, index) => ({
      id: option.id,
      day: option.day,
      startTime: option.startTime ?? "",
      endTime: option.endTime ?? "",
      label: formatOption(option, locale),
      ...tallies[index],
      leading: lead.has(option.id),
    })),
  };
}

export async function generateMetadata({ params }: PageProps<"/events/[id]">): Promise<Metadata> {
  const [host, { id }, t] = await Promise.all([requireHost(), params, getTranslations("Editor")]);
  const event = await findHostEvent(host.id, id);
  return { title: event ? event.title || t("titlePlaceholder") : undefined, robots: { index: false, follow: false } };
}

// The invitation is the editor (M4 spec, "The editor"): the event's own page as its guests will see
// it, in the Poster layout, with the title typed on the poster and When, Where and About filled in
// from small sheets, each saved as it is made. Above it, close, the save status, Preview, Publish
// or Share, and More, where the 0.4 manage page's links went; below it, the toolbar, with Poster,
// Title, Theme, Effect, Arrange and Settings. Its co-hosts get the same, less what is the owner's
// alone (hosts/role.ts).
export default async function EditorPage({ params, searchParams }: PageProps<"/events/[id]">) {
  const [host, { id }, { from, sheet }, locale, t] = await Promise.all([requireHost(), params, searchParams, getLocale(), getTranslations("Events.manage")]);
  const event = await findHostEvent(host.id, id);
  if (!event) notFound();
  // Where a duplicate came from, said only when the host can see that event themselves.
  const source = typeof from === "string" ? await findHostEvent(host.id, from) : undefined;
  const [questions, answerCounts, counts, limits, upload, hosts, editor, schedule, album, switches] = await Promise.all([
    listQuestions(event.id),
    countAnswersByQuestion(event.id),
    countRsvpsByEvent([event.id]),
    instanceLimits(),
    findEventUpload(event.id),
    eventHosts(event.id),
    getTranslations("Editor"),
    listSchedule(event.id),
    albumTotals(event.id),
    siteFeatures(),
  ]);
  // What the operator has switched on (M8 ticket 01): the Settings sheet leaves out the rest.
  const features = { album: featureOn(switches, "album"), videos: featureOn(switches, "videos") };
  const picture = upload ? themeUpload(upload) : null;
  const replies = counts.get(event.id);
  const rsvps = replies ? replies.going + replies.maybe + replies.cant + replies.waitlisted + replies.pending + replies.declined : 0;
  // Once the clock's sweep has marked the event, the day it will be deleted for its age (spec,
  // "Retention").
  const deletion = deletionDate(event, limits.retentionDays, retentionFloorDays());
  const dated = isDated(event) ? event : undefined;
  // The date poll (M4 ticket 09): a draft may start one; one open shows its candidates and votes.
  const pollNow = pollState(event);
  const poll = pollNow === "open" || (event.state === "draft" && pollNow === "none") ? await editablePoll(event.id, pollNow === "open", event.state === "draft", locale) : undefined;
  const details: EditableDetails = {
    eventId: event.id,
    poll,
    when: dated ? formatWhen(dated, locale) : poll?.open ? editor("poll.whenPoll", { count: poll.voters }) : null,
    start: dated ? toWallTime(dated.startsAt, event.timeZone) : "",
    end: event.endsAt ? toWallTime(event.endsAt, event.timeZone) : "",
    allDay: event.allDay,
    timeZone: event.timeZone,
    dated: dated !== undefined,
    location: event.location,
    retentionDays: limits.retentionDays,
    description: event.description,
    descriptionRich: event.descriptionRich,
    schedule: { items: schedule, refresh: event.scheduleRefresh },
  };
  const link = eventUrl(event);
  const facts = [t("opened", { count: event.views }), ...(event.capacity !== null ? [t("headcountOf", { count: replies?.headcount ?? 0, capacity: event.capacity })] : [])];
  // What the host should not have to look for, under the top bar: where a duplicate came from,
  // said only when the host can see that event themselves, and the day the event will be deleted
  // for its age.
  const notices = [
    ...(source ? [t("duplicatedFrom", { title: source.title })] : []),
    ...(deletion ? [t("deletionDate", { date: formatDay(deletion, event.timeZone, locale) })] : []),
  ];
  // The album's reminder, once the clock has sent it and while the album holds anything and the
  // host has not answered it (M7 ticket 09): Empty the album, or Keep it. None while the album is
  // switched off.
  const reminded = features.album && event.albumRemindedAt !== null && event.albumReminderDays !== null && album.photos + album.videos > 0;
  // The page's sections as the host has arranged them (M8 ticket 25), and the switches Arrange
  // turns with them, which are the event's columns.
  const arrangement = parseArrangement(event.sections);
  const sectionSwitches: Switches = {
    lettersEnabled: event.lettersEnabled,
    commentsEnabled: event.commentsEnabled,
    guestListVisibility: event.guestListVisibility,
    albumEnabled: event.albumEnabled,
  };

  return (
    <ClientMessages namespaces={["Editor", "Design", "Posters", "Events.form", "Events.manage", "Events.album", "Voting"]}>
      {/* The invite list's link to the settings opens the editor with them open (M6 ticket 08). */}
      <EditorProvider sheet={sheet === "settings" ? "settings" : null}>
        <ThemedPage
          theme={event.theme}
          upload={picture}
          designer={
            <>
              <EditorTopBar
                menu={{
                  eventId: event.id,
                  title: event.title,
                  link,
                  facts,
                  state: event.state,
                  coHost: event.role === "coHost",
                  hosts: can(event.role, "manageCoHosts"),
                  invites: can(event.role, "guests"),
                  duplicate: can(event.role, "duplicate"),
                  deletable: can(event.role, "delete"),
                  rsvps,
                }}
              />
              {(notices.length > 0 || reminded) && (
                <div className="fixed inset-x-3 top-[calc(max(env(safe-area-inset-top),0.75rem)+3rem)] z-30 mx-auto flex max-w-md flex-col gap-2">
                  {notices.map((notice) => (
                    <p key={notice} className="dark rounded-2xl border bg-popover/95 px-4 py-2.5 text-sm text-popover-foreground shadow-lg backdrop-blur-xl">
                      {notice}
                    </p>
                  ))}
                  {reminded && <AlbumReminderNotice eventId={event.id} album={album} className="dark rounded-2xl border bg-popover/95 px-4 py-3 text-popover-foreground shadow-lg backdrop-blur-xl" />}
                </div>
              )}
              <EditorToolbar
                sheets={
                  <>
                    <DesignSheets eventId={event.id} title={event.title} maxUploadBytes={limits.maxPhotoMb * MEGABYTE} />
                    <ArrangeSheet
                      eventId={event.id}
                      layout={event.theme.layout}
                      arrangement={arrangement}
                      switches={sectionSwitches}
                      offered={{ album: features.album }}
                      headings={await defaultHeadings(event.theme.layout)}
                    />
                    {/* Each Note's and Links' own sheet (M8 ticket 29), which its row and its
                        drawing on the invitation open. */}
                    {arrangement?.sections.map((section) =>
                      section.kind === "note" ? (
                        <NoteSheet key={sectionKey(section)} eventId={event.id} section={section} />
                      ) : section.kind === "links" ? (
                        <LinksSheet key={sectionKey(section)} eventId={event.id} section={section} />
                      ) : null,
                    )}
                    <SettingsSheet
                      eventId={event.id}
                      settings={event}
                      mail={isMailConfigured()}
                      maxReplies={limits.maxRsvpsPerEvent}
                      siteVideo={{ maxMinutes: limits.maxVideoMinutes, maxMb: limits.maxVideoMb, available: ffmpegStatus().available }}
                      features={features}
                      album={album}
                      reminderDays={event.albumReminderDays}
                      voting={<VotingSettings event={event} />}
                      questions={questions}
                      answerCounts={answerCounts}
                    />
                  </>
                }
              />
            </>
          }
        >
          <PosterLayout
            event={{ ...event, hostName: hosts[0]?.name ?? "" }}
            hosts={hosts.map((each) => each.name)}
            sections={await previewSections(arrangement, event.theme.layout, sectionSwitches, <EditorDetails details={details} timeZones={timeZones()} />, { album: features.album }, dated !== undefined)}
            edit={{
              title: {
                full: <EditableTitle eventId={event.id} title={event.title} compact={false} />,
                compact: <EditableTitle eventId={event.id} title={event.title} compact />,
              },
              foot: (
                <p className="px-2 pt-2 text-sm text-theme-text-muted">
                  {editor("guestsAlsoSee")}{" "}
                  <Link href={link} prefetch={false} className="font-medium text-theme-text underline underline-offset-2">
                    {editor("seeAsGuest")}
                  </Link>
                </p>
              ),
            }}
          />
          {/* The page's own footer, with the instance's legal pages, and room under it for the
              toolbar, whatever layout the theme names. */}
          <PageFooter themed />
          <div aria-hidden className="h-24" />
        </ThemedPage>
      </EditorProvider>
    </ClientMessages>
  );
}
