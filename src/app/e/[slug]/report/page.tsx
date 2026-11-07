import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { findEventBySlug } from "@/events/repository";
import { gateFor } from "@/invites/gate";
import { eventPath, isSlug } from "@/events/slug";
import { ClientMessages } from "@/locale/client-messages";
import { turnstileSiteKey } from "@/turnstile/config";
import { ReportForm } from "./report-form";

// A published or cancelled event's report form; a draft is not public, so for everyone it is a page
// that does not exist, as an unknown link is.
async function reportedEvent(slug: string) {
  const event = isSlug(slug) ? await findEventBySlug(slug) : undefined;
  return event && event.state !== "draft" ? event : undefined;
}

export async function generateMetadata({ params }: PageProps<"/e/[slug]/report">): Promise<Metadata> {
  const { slug } = await params;
  const event = await reportedEvent(slug);
  const robots = { index: false, follow: false };
  if (!event) return { title: (await getTranslations("NotFound"))("title"), robots };
  if ((await gateFor(event)).page !== "invitation") return { title: (await getTranslations("EventPage"))("lockedTitle"), robots };
  return { title: (await getTranslations("Report"))("title", { title: event.title }), robots };
}

// Report this event (spec, "Report an event"): a plain page, in the viewer's language rather than
// the event's theme, so that it reads the same whatever the host chose. Of an invite-only event,
// only those in may report it; anyone else is sent to the locked page (M6 spec, "What the lock
// covers"), as a page that drew nothing would be an empty shell.
export default async function ReportPage({ params }: PageProps<"/e/[slug]/report">) {
  const { slug } = await params;
  const event = await reportedEvent(slug);
  if (!event) notFound();
  if ((await gateFor(event)).page !== "invitation") redirect(eventPath(event));
  const t = await getTranslations("Report");
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-lg flex-col justify-center gap-6 px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle>
            <h1>{t("title", { title: event.title })}</h1>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ClientMessages namespaces={["Report", "Turnstile"]}>
            <ReportForm slug={slug} eventPath={eventPath(event)} turnstileSiteKey={turnstileSiteKey()} />
          </ClientMessages>
        </CardContent>
      </Card>
    </main>
  );
}
