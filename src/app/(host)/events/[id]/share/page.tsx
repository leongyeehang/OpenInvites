import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
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
import { baseUrl } from "@/instance/env";
import { qrSvg } from "@/sharing/qr";
import { ShareActions } from "./share-actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Events.share");
  return { title: t("title") };
}

// Everything a host needs to get the link into someone's hands: the link itself, their phone's
// share sheet, a code to hold up at the door, and the way to start again if it leaks.
export default async function SharePage({ params }: PageProps<"/events/[id]/share">) {
  const [host, { id }, t] = await Promise.all([requireHost(), params, getTranslations("Events")]);
  const event = await findHostEvent(host.id, id);
  if (!event) notFound();
  const link = `${baseUrl()}/e/${event.slug}`;

  return (
    <>
      <div className="flex flex-col gap-1">
        <Link href={`/events/${event.id}`} className="text-sm text-muted-foreground hover:underline">
          {t("share.backToEvent")}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{t("share.title")}</h1>
      </div>

      <p className="break-all font-mono text-sm">{link}</p>
      <ShareActions link={link} title={event.title} />

      <section aria-labelledby="qr-heading" className="flex flex-col gap-3">
        <h2 id="qr-heading" className="text-lg font-medium">
          {t("share.qr")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("share.qrHint")}</p>
        {/* Its name carries the link it encodes, for anyone who cannot scan it. */}
        <div
          role="img"
          aria-label={t("share.qrLabel", { link })}
          className="w-48 max-w-full rounded-xl bg-white p-3 ring-1 ring-foreground/10 [&>svg]:h-auto [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: qrSvg(link) }}
        />
      </section>

      <section aria-labelledby="reset-heading" className="flex flex-col gap-3">
        <h2 id="reset-heading" className="text-lg font-medium">
          {t("share.reset")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("share.resetHint")}</p>
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
      </section>
    </>
  );
}
