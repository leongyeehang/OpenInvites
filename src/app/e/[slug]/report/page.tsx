import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { findEventBySlug } from "@/events/repository";
import { eventPath, isSlug } from "@/events/slug";
import { ClientMessages } from "@/locale/client-messages";
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
  const t = await getTranslations("Report");
  return { title: event ? t("title", { title: event.title }) : (await getTranslations("NotFound"))("title"), robots: { index: false, follow: false } };
}

// Report this event (spec, "Report an event"): a plain page, in the viewer's language rather than
// the event's theme, so that it reads the same whatever the host chose.
export default async function ReportPage({ params }: PageProps<"/e/[slug]/report">) {
  const { slug } = await params;
  const event = await reportedEvent(slug);
  if (!event) notFound();
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
          <ClientMessages namespaces={["Report"]}>
            <ReportForm slug={slug} eventPath={eventPath(event)} />
          </ClientMessages>
        </CardContent>
      </Card>
    </main>
  );
}
