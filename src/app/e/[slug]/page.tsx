import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/auth/session";
import { Alert, AlertAction, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { findEventBySlug } from "@/events/repository";
import { isSlug } from "@/events/slug";
import { formatWhen } from "@/events/time";

// Event pages are never indexed (ADR-0004). The header carries the same signal (next.config.ts).
const noindex: Metadata["robots"] = { index: false, follow: false };

export async function generateMetadata({ params }: PageProps<"/e/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const event = isSlug(slug) ? await findEventBySlug(slug) : undefined;
  const [t, notFound] = await Promise.all([getTranslations("EventPage"), getTranslations("NotFound")]);
  const title = !event ? notFound("title") : event.state === "published" ? event.title : t("notReadyTitle");
  return { title, robots: noindex };
}

// The event page: the invitation itself. Ticket 06 gives it the theme; this is the bare page.
export default async function EventPage({ params }: PageProps<"/e/[slug]">) {
  const { slug } = await params;
  if (!isSlug(slug)) notFound();
  const event = await findEventBySlug(slug);
  if (!event) notFound();
  const [t, locale] = await Promise.all([getTranslations("EventPage"), getLocale()]);

  const isDraft = event.state === "draft";
  if (isDraft) {
    const session = await getSession();
    if (session?.user.id !== event.hostId) {
      return (
        <main className="mx-auto flex min-h-svh w-full max-w-xl flex-col justify-center gap-3 px-4 py-12">
          <h1 className="text-3xl font-semibold tracking-tight">{t("notReadyTitle")}</h1>
          <p className="text-muted-foreground">{t("notReady")}</p>
        </main>
      );
    }
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-xl flex-col gap-8 px-4 py-12">
      {isDraft && (
        <Alert>
          <AlertDescription>{t("draftBanner")}</AlertDescription>
          <AlertAction>
            <Button asChild size="sm" variant="outline">
              <Link href={`/events/${event.id}`}>{t("edit")}</Link>
            </Button>
          </AlertAction>
        </Alert>
      )}
      <header className="flex flex-col gap-2">
        <h1 className="text-4xl font-semibold tracking-tight">{event.title}</h1>
        <p className="text-muted-foreground">{t("hostedBy", { name: event.hostName })}</p>
      </header>
      <dl className="flex flex-col gap-4">
        <div>
          <dt className="text-sm text-muted-foreground">{t("when")}</dt>
          <dd className="text-lg">{formatWhen(event, locale)}</dd>
        </div>
        {event.location && (
          <div>
            <dt className="text-sm text-muted-foreground">{t("where")}</dt>
            <dd className="text-lg">{event.location}</dd>
          </div>
        )}
        {event.description && (
          <div>
            <dt className="text-sm text-muted-foreground">{t("about")}</dt>
            <dd className="whitespace-pre-line">{event.description}</dd>
          </div>
        )}
      </dl>
    </main>
  );
}
