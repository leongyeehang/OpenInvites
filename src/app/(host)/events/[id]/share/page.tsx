import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { requireHost } from "@/auth/session";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { resetLinkAction } from "@/events/actions";
import { findHostEvent } from "@/events/repository";
import { ClientMessages } from "@/locale/client-messages";
import { qrSvg } from "@/sharing/qr";
import { Glass } from "@/themes/glass";
import { ManageHeading, ManageIntro } from "../manage-heading";
import { CustomLinkForm } from "./custom-link-form";
import { ShareActions } from "./share-actions";
import { eventUrl } from "@/events/slug";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Events.share");
  return { title: t("title") };
}

// Everything a host needs to get the link into someone's hands: the link itself, their phone's
// share sheet, a code to hold up at the door, and the way to start again if it leaks. On the
// event's poster (layout.tsx), the heading sits on the veil and each part in a glass panel (M8
// ticket 21).
export default async function SharePage({ params }: PageProps<"/events/[id]/share">) {
  const [host, { id }, t] = await Promise.all([requireHost(), params, getTranslations("Events")]);
  const event = await findHostEvent(host.id, id);
  if (!event) notFound();
  const link = eventUrl(event);

  return (
    <>
      <ManageIntro back={`/events/${event.id}`} label={t("share.backToEvent")} heading={<ManageHeading font={event.theme.font}>{t("share.title")}</ManageHeading>} />

      <Glass className="flex flex-col gap-3 p-4 md:p-5">
        <p className="break-all font-mono text-sm">{link}</p>
        <ClientMessages namespaces={["Events.share"]}>
          <ShareActions link={link} title={event.title} />
        </ClientMessages>
      </Glass>

      <SharePanel id="qr-heading" heading={t("share.qr")}>
        <p className="text-sm text-muted-foreground">{t("share.qrHint")}</p>
        {/* Its name carries the link it encodes, for anyone who cannot scan it. The white tile is
            the code's own, which a scanner needs, whatever the poster. */}
        <div
          role="img"
          aria-label={t("share.qrLabel", { link })}
          className="w-48 max-w-full rounded-xl bg-white p-3 ring-1 ring-foreground/10 [&>svg]:h-auto [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: qrSvg(link) }}
        />
      </SharePanel>

      <SharePanel id="custom-link-heading" heading={t("share.customLink.title")}>
        <p className="text-sm text-muted-foreground">{t("share.customLink.guessable")}</p>
        <ClientMessages namespaces={["Events.share.customLink"]}>
          <CustomLinkForm eventId={event.id} prefix={eventUrl({ slug: "", customSlug: null })} custom={event.customSlug} link={event.customSlug ? link : null} randomLink={eventUrl({ slug: event.slug, customSlug: null })} />
        </ClientMessages>
      </SharePanel>

      <SharePanel id="reset-heading" heading={t("share.reset")}>
        <p className="text-sm text-muted-foreground">{t("share.resetHint")}</p>
        <p className="text-sm text-muted-foreground">{t("share.customLink.resetRetires")}</p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="self-start">
              {t("share.reset")}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <form action={resetLinkAction.bind(null, event.id)}>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("share.resetTitle")}</AlertDialogTitle>
                <AlertDialogDescription>{t("share.resetText")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="pt-4">
                <AlertDialogCancel type="button">{t("manage.keep")}</AlertDialogCancel>
                <Button type="submit" variant="destructive">
                  {t("share.resetConfirm")}
                </Button>
              </AlertDialogFooter>
            </form>
          </AlertDialogContent>
        </AlertDialog>
      </SharePanel>
    </>
  );
}

// One part of the page, its heading and what it holds, in a glass panel of its own.
function SharePanel({ id, heading, children }: { id: string; heading: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id}>
      <Glass className="flex flex-col gap-3 p-4 md:p-5">
        <h2 id={id} className="text-lg font-medium">
          {heading}
        </h2>
        {children}
      </Glass>
    </section>
  );
}
