import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { getSession } from "@/auth/session";
import { findEventBySlug } from "@/events/repository";
import { isSlug } from "@/events/slug";
import { PosterLayout } from "@/themes/poster-layout";
import { resolveTheme } from "@/themes/resolve";
import { ThemedPage } from "@/themes/themed-page";
import { DraftNotice } from "./draft-notice";

// Event pages are never indexed (ADR-0004). The header carries the same signal (next.config.ts).
const noindex: Metadata["robots"] = { index: false, follow: false };

export async function generateMetadata({ params }: PageProps<"/e/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const event = isSlug(slug) ? await findEventBySlug(slug) : undefined;
  const [t, notFound] = await Promise.all([getTranslations("EventPage"), getTranslations("NotFound")]);
  const title = !event ? notFound("title") : event.state === "published" ? event.title : t("notReadyTitle");
  return { title, robots: noindex };
}

// The event page: the invitation itself, rendered on the server in the event's theme so the
// first paint is the finished look. M1 ships the Poster layout; resolveTheme maps every stored
// layout to it.
export default async function EventPage({ params }: PageProps<"/e/[slug]">) {
  const { slug } = await params;
  if (!isSlug(slug)) notFound();
  const event = await findEventBySlug(slug);
  if (!event) notFound();

  const isDraft = event.state === "draft";
  if (isDraft) {
    const session = await getSession();
    if (session?.user.id !== event.hostId) {
      const t = await getTranslations("EventPage");
      return (
        <main className="mx-auto flex min-h-svh w-full max-w-xl flex-col justify-center gap-3 px-4 py-12">
          <h1 className="text-3xl font-semibold tracking-tight">{t("notReadyTitle")}</h1>
          <p className="text-muted-foreground">{t("notReady")}</p>
        </main>
      );
    }
  }

  const theme = resolveTheme(event.theme);
  return (
    <ThemedPage theme={theme}>
      <PosterLayout event={event} theme={theme} notice={isDraft ? <DraftNotice eventId={event.id} /> : undefined} />
    </ThemedPage>
  );
}
