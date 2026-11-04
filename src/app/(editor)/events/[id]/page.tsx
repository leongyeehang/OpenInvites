import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireHost } from "@/auth/session";
import { PageFooter } from "@/components/page-footer";
import { DesignSheets } from "@/editor/design-sheets";
import { EditorDetails, type EditableDetails } from "@/editor/details";
import { EditableTitle } from "@/editor/editable-title";
import { SettingsSheet, EditorToolbar } from "@/editor/settings-sheet";
import { EditorProvider } from "@/editor/status";
import { EditorTopBar } from "@/editor/top-bar";
import { eventHosts } from "@/events/hosts";
import { findHostEvent } from "@/events/repository";
import { eventUrl } from "@/events/slug";
import { formatDay, formatWhen, isDated, timeZones, toWallTime } from "@/events/time";
import { can } from "@/hosts/role";
import { maxUploadBytes } from "@/instance/env";
import { instanceLimits } from "@/instance/repository";
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

export async function generateMetadata({ params }: PageProps<"/events/[id]">): Promise<Metadata> {
  const [host, { id }, t] = await Promise.all([requireHost(), params, getTranslations("Editor")]);
  const event = await findHostEvent(host.id, id);
  return { title: event ? event.title || t("titlePlaceholder") : undefined, robots: { index: false, follow: false } };
}

// The invitation is the editor (M4 spec, "The editor"): the event's own page as its guests will see
// it, in the Poster layout, with the title typed on the poster and When, Where and About filled in
// from small sheets, each saved as it is made. Above it, close, the save status, Preview, Publish
// or Share, and More, where the 0.4 manage page's links went; below it, the toolbar, with Poster,
// Title, Theme, Effect and Settings. Its co-hosts get the same, less what is the owner's alone (hosts/role.ts).
export default async function EditorPage({ params, searchParams }: PageProps<"/events/[id]">) {
  const [host, { id }, { from }, locale, t] = await Promise.all([requireHost(), params, searchParams, getLocale(), getTranslations("Events.manage")]);
  const event = await findHostEvent(host.id, id);
  if (!event) notFound();
  // Where a duplicate came from, said only when the host can see that event themselves.
  const source = typeof from === "string" ? await findHostEvent(host.id, from) : undefined;
  const [questions, answerCounts, counts, limits, upload, hosts, editor] = await Promise.all([
    listQuestions(event.id),
    countAnswersByQuestion(event.id),
    countRsvpsByEvent([event.id]),
    instanceLimits(),
    findEventUpload(event.id),
    eventHosts(event.id),
    getTranslations("Editor"),
  ]);
  const picture = upload ? themeUpload(upload) : null;
  const replies = counts.get(event.id);
  const rsvps = replies ? replies.going + replies.maybe + replies.cant + replies.waitlisted + replies.pending + replies.declined : 0;
  // Once the clock's sweep has marked the event, the day it will be deleted for its age (spec,
  // "Retention").
  const deletion = deletionDate(event, limits.retentionDays, retentionFloorDays());
  const dated = isDated(event) ? event : undefined;
  const details: EditableDetails = {
    eventId: event.id,
    when: dated ? formatWhen(dated, locale) : null,
    start: dated ? toWallTime(dated.startsAt, event.timeZone) : "",
    end: event.endsAt ? toWallTime(event.endsAt, event.timeZone) : "",
    allDay: event.allDay,
    timeZone: event.timeZone,
    dated: dated !== undefined,
    location: event.location,
    retentionDays: limits.retentionDays,
    description: event.description,
    descriptionRich: event.descriptionRich,
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

  // The Poster layout brings the comments' reactions with it, which read EventPage.comments, though
  // the editor shows no comments.
  return (
    <ClientMessages namespaces={["Editor", "Design", "Posters", "Events.form", "Events.manage", "EventPage.comments"]}>
      <EditorProvider>
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
              {notices.length > 0 && (
                <div className="fixed inset-x-3 top-[calc(max(env(safe-area-inset-top),0.75rem)+3rem)] z-30 mx-auto flex max-w-md flex-col gap-2">
                  {notices.map((notice) => (
                    <p key={notice} className="dark rounded-2xl border bg-popover/95 px-4 py-2.5 text-sm text-popover-foreground shadow-lg backdrop-blur-xl">
                      {notice}
                    </p>
                  ))}
                </div>
              )}
              <EditorToolbar
                sheets={
                  <>
                    <DesignSheets eventId={event.id} title={event.title} maxUploadBytes={maxUploadBytes()} />
                    <SettingsSheet
                      eventId={event.id}
                      settings={event}
                      mail={isMailConfigured()}
                      maxReplies={limits.maxRsvpsPerEvent}
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
            announcements={[]}
            edit={{
              title: {
                full: <EditableTitle eventId={event.id} title={event.title} compact={false} />,
                compact: <EditableTitle eventId={event.id} title={event.title} compact />,
              },
              details: <EditorDetails details={details} timeZones={timeZones()} />,
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
