import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireHost } from "@/auth/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { publishEventAction, updateEventAction } from "@/events/actions";
import { findHostEvent } from "@/events/repository";
import { can } from "@/hosts/role";
import { countAnswersByQuestion, listQuestions } from "@/questions/repository";
import { instanceLimits } from "@/instance/repository";
import { countRsvpsByEvent } from "@/rsvps/repository";
import { formatDay, timeZones } from "@/events/time";
import { ClientMessages } from "@/locale/client-messages";
import { isMailConfigured } from "@/mail/config";
import { retentionFloorDays } from "@/retention/floor";
import { deletionDate } from "@/retention/plan";
import { EventForm } from "../event-form";
import { DangerZone } from "../danger-zone";
import { DuplicateButton } from "../duplicate-button";
import { EventStateBadge } from "../event-state-badge";
import { eventPath, eventUrl } from "@/events/slug";

export async function generateMetadata({ params }: PageProps<"/events/[id]">): Promise<Metadata> {
  const [host, { id }] = await Promise.all([requireHost(), params]);
  const event = await findHostEvent(host.id, id);
  return { title: event?.title };
}

// The host's page for one event: its link and state, then the same form as creating it. A co-host
// gets the same page, marked as theirs to co-host, without what is the owner's alone: deleting the
// event and choosing its co-hosts (hosts/role.ts).
export default async function ManageEventPage({ params, searchParams }: PageProps<"/events/[id]">) {
  const [host, { id }, { from }, t, locale] = await Promise.all([requireHost(), params, searchParams, getTranslations("Events"), getLocale()]);
  const event = await findHostEvent(host.id, id);
  if (!event) notFound();
  // Where a duplicate came from, said only when the host can see that event themselves.
  const source = typeof from === "string" ? await findHostEvent(host.id, from) : undefined;
  const link = eventUrl(event);
  const [questions, answerCounts, counts, limits] = await Promise.all([
    listQuestions(event.id),
    countAnswersByQuestion(event.id),
    countRsvpsByEvent([event.id]),
    instanceLimits(),
  ]);
  const replies = counts.get(event.id);
  // Once the clock's sweep has marked the event, the day it will be deleted for its age (spec,
  // "Retention"), with or without mail.
  const deletion = deletionDate(event, limits.retentionDays, retentionFloorDays());

  return (
    <ClientMessages namespaces={["Events.form", "Events.manage"]}>
      {source && (
        <p role="status" className="rounded-md border bg-muted px-4 py-3 text-sm">
          {t("manage.duplicatedFrom", { title: source.title })}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{event.title}</h1>
        <EventStateBadge state={event.state} />
        {event.role === "coHost" && <Badge variant="outline">{t("manage.coHost")}</Badge>}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>{t("manage.link")}</h2>
          </CardTitle>
          <CardDescription>
            {event.state === "cancelled"
              ? t("manage.cancelledHint")
              : event.state === "published"
                ? t("manage.publishedHint")
                : t("manage.draftHint")}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="break-all font-mono text-sm">{link}</p>
          <p className="text-sm text-muted-foreground">{t("manage.opened", { count: event.views })}</p>
          {event.capacity !== null && (
            <p className="text-sm text-muted-foreground">
              {t("manage.headcountOf", { count: replies?.headcount ?? 0, capacity: event.capacity })}
            </p>
          )}
          {deletion && <p className="text-sm font-medium">{t("manage.deletionDate", { date: formatDay(deletion, event.timeZone, locale) })}</p>}
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={eventPath(event)}>{t("manage.view")}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/events/${event.id}/guests`}>{t("manage.guests")}</Link>
            </Button>
            {can(event.role, "guests") && (
              <Button asChild variant="outline">
                <Link href={`/events/${event.id}/invites`}>{t("manage.invites")}</Link>
              </Button>
            )}
            <Button asChild variant="outline">
              <Link href={`/events/${event.id}/share`}>{t("manage.share")}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/events/${event.id}/announcements`}>{t("manage.announcements")}</Link>
            </Button>
            {can(event.role, "manageCoHosts") && (
              <Button asChild variant="outline">
                <Link href={`/events/${event.id}/hosts`}>{t("manage.hosts")}</Link>
              </Button>
            )}
            {can(event.role, "duplicate") && (
              <DuplicateButton eventId={event.id} label={t("manage.duplicate")} hint={t("manage.duplicateHint")} />
            )}
            {event.state === "draft" && (
              <form action={publishEventAction.bind(null, event.id)}>
                <Button type="submit" title={t("manage.publishHint")}>
                  {t("manage.publish")}
                </Button>
              </form>
            )}
          </div>
        </CardContent>
      </Card>
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">{t("edit.title")}</h2>
        <EventForm
          action={updateEventAction.bind(null, event.id)}
          event={event}
          mail={isMailConfigured()}
          maxReplies={limits.maxRsvpsPerEvent}
          retentionDays={limits.retentionDays}
          timeZones={timeZones()}
          submitLabel={t("edit.submit")}
          questions={questions}
          answerCounts={answerCounts}
        />
      </section>
      <DangerZone
        eventId={event.id}
        title={event.title}
        cancellable={event.state === "published"}
        deletable={can(event.role, "delete")}
        rsvps={
          (replies?.going ?? 0) +
          (replies?.maybe ?? 0) +
          (replies?.cant ?? 0) +
          (replies?.waitlisted ?? 0) +
          (replies?.pending ?? 0) +
          (replies?.declined ?? 0)
        }
      />
    </ClientMessages>
  );
}
