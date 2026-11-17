import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { findEventBySlug } from "@/events/repository";
import { gateFor } from "@/invites/gate";
import { eventPath, isSlug } from "@/events/slug";
import { posterPool } from "@/instance/home";
import { homePage } from "@/instance/repository";
import { areaLook } from "@/instance/site-look";
import { ClientMessages } from "@/locale/client-messages";
import { SitePage } from "@/themes/site-page";
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

// Report this event (spec, "Report an event"), in the viewer's language. It wears the site's
// backdrop, the guest area's poster from the site's set, never the event's Theme, so it reads the
// same whatever the host chose (M8 spec, "Glass", "Which poster"). Of an invite-only event,
// only those in may report it; anyone else is sent to the locked page (M6 spec, "What the lock
// covers"), as a page that drew nothing would be an empty shell.
export default async function ReportPage({ params }: PageProps<"/e/[slug]/report">) {
  const { slug } = await params;
  const event = await reportedEvent(slug);
  if (!event) notFound();
  if ((await gateFor(event)).page !== "invitation") redirect(eventPath(event));
  const [t, page] = await Promise.all([getTranslations("Report"), homePage()]);
  return (
    <SitePage look={areaLook(posterPool(page), "guest")}>
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-6 px-4 py-12">
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
    </SitePage>
  );
}
