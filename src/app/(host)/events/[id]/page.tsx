import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireHost } from "@/auth/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { publishEventAction, updateEventAction } from "@/events/actions";
import { findHostEvent } from "@/events/repository";
import { timeZones } from "@/events/time";
import { baseUrl } from "@/instance/env";
import { EventForm } from "../event-form";
import { EventStateBadge } from "../event-state-badge";

export async function generateMetadata({ params }: PageProps<"/events/[id]">): Promise<Metadata> {
  const [host, { id }] = await Promise.all([requireHost(), params]);
  const event = await findHostEvent(host.id, id);
  return { title: event?.title };
}

// The host's page for one event: its link and state, then the same form as creating it.
export default async function ManageEventPage({ params }: PageProps<"/events/[id]">) {
  const [host, { id }, t] = await Promise.all([requireHost(), params, getTranslations("Events")]);
  const event = await findHostEvent(host.id, id);
  if (!event) notFound();
  const link = `${baseUrl()}/e/${event.slug}`;

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{event.title}</h1>
        <EventStateBadge state={event.state} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>{t("manage.link")}</h2>
          </CardTitle>
          <CardDescription>{event.state === "published" ? t("manage.publishedHint") : t("manage.draftHint")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="break-all font-mono text-sm">{link}</p>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={`/e/${event.slug}`}>{t("manage.view")}</Link>
            </Button>
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
          timeZones={timeZones()}
          submitLabel={t("edit.submit")}
        />
      </section>
    </>
  );
}
