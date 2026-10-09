import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { requireOperator } from "@/auth/session";
import { DeleteDialogContent } from "@/components/delete-dialog-content";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deleteReportedEventAction, markReportHandledAction } from "@/reports/actions";
import { listReports, type ReportListed } from "@/reports/repository";
import { HostHeader } from "../../(host)/host-header";
import { eventPath } from "@/events/slug";

// The page's heading, where the focus goes once an event is deleted, since its Delete button goes
// with it.
const HEADING = "reports-heading";

export async function generateMetadata(): Promise<Metadata> {
  await requireOperator();
  const t = await getTranslations("Instance.reports");
  return { title: t("title") };
}

// The reports inbox (spec, "Report an event"): every report, what is not handled first, then the
// newest. Outside the host area's layout, like /instance, since it is the operator's alone.
export default async function ReportsPage() {
  const host = await requireOperator();
  const [t, reports] = await Promise.all([getTranslations("Instance.reports"), listReports()]);

  return (
    <>
      <HostHeader host={host} />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
        <div className="flex flex-col gap-1">
          <Link href="/instance" className="text-sm text-muted-foreground hover:underline">
            {t("back")}
          </Link>
          <h1 id={HEADING} tabIndex={-1} className="text-2xl font-semibold tracking-tight outline-none">
            {t("title")}
          </h1>
        </div>
        <p className="text-muted-foreground">{t("description")}</p>
        {reports.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {reports.map((each) => (
              <ReportRow key={each.id} report={each} />
            ))}
          </ul>
        )}
      </main>
    </>
  );
}

async function ReportRow({ report }: { report: ReportListed }) {
  const [t, format] = await Promise.all([getTranslations("Instance.reports"), getFormatter()]);
  // A report whose event is gone counts as handled, whoever deleted the event.
  const eventExists = report.eventId !== null && report.eventSlug !== null;
  const handled = report.handledAt !== null || !eventExists;
  const sent = format.dateTime(report.createdAt, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC", timeZoneName: "short" });
  return (
    <li className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-medium break-words">
          {eventExists ? (
            <Link href={eventPath({ slug: report.eventSlug!, customSlug: report.eventCustomSlug })} className="underline underline-offset-4">
              {report.eventTitle}
            </Link>
          ) : (
            report.eventTitle
          )}
        </h2>
        {!eventExists && <Badge variant="outline">{t("eventDeleted")}</Badge>}
        {handled && <Badge variant="secondary">{t("handled")}</Badge>}
      </div>
      <p className="break-words whitespace-pre-wrap">{report.reason}</p>
      <p className="text-sm break-all text-muted-foreground">
        {report.contact ? (
          <>
            {t("contact")}:{" "}
            <a href={`mailto:${report.contact}`} className="underline underline-offset-4">
              {report.contact}
            </a>
          </>
        ) : (
          t("noContact")
        )}
        {" · "}
        <time dateTime={report.createdAt.toISOString()}>{t("sent", { time: sent })}</time>
      </p>
      {!handled && report.eventId && (
        <div className="flex flex-wrap gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                {t("deleteEvent")}
              </Button>
            </AlertDialogTrigger>
            <DeleteDialogContent focusAfter={HEADING}>
              <form action={deleteReportedEventAction.bind(null, report.eventId)}>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("deleteTitle", { title: report.eventTitle })}</AlertDialogTitle>
                  <AlertDialogDescription>{t("deleteText")}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="pt-4">
                  <AlertDialogCancel type="button">{t("keep")}</AlertDialogCancel>
                  <Button type="submit" variant="destructive">
                    {t("deleteConfirm")}
                  </Button>
                </AlertDialogFooter>
              </form>
            </DeleteDialogContent>
          </AlertDialog>
          <form action={markReportHandledAction.bind(null, report.id)}>
            <Button type="submit" variant="outline" size="sm">
              {t("markHandled")}
            </Button>
          </form>
        </div>
      )}
    </li>
  );
}
