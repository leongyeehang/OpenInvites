import { and, asc, desc, eq, inArray, isNotNull, isNull, ne, or, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { event, report } from "@/db/schema";
import { removeEvents } from "@/events/repository";

export type Report = typeof report.$inferSelect;

// A report with what the inbox needs of its event while it still exists.
export type ReportListed = Report & { eventSlug: string | null; eventCustomSlug: string | null; eventState: "draft" | "published" | "cancelled" | null };

// A report names a published or a cancelled event, whose title is copied now so it can still be
// read once the event is gone.
export async function createReport(found: { id: string; title: string }, fields: { reason: string; contact: string | null }): Promise<Report> {
  const [created] = await getDb()
    .insert(report)
    .values({ eventId: found.id, eventTitle: found.title, reason: fields.reason, contact: fields.contact })
    .returning();
  return created;
}

// Whether an event link leads to an event that can be reported: one that is not a draft. The proxy
// asks this before the report page is drawn (src/proxy.ts).
export async function reportableEventExists(slug: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: event.id })
    .from(event)
    .where(and(or(eq(event.slug, slug), eq(event.customSlug, slug)), ne(event.state, "draft")))
    .limit(1);
  return row !== undefined;
}

// The inbox: what is not yet handled first, then the newest first.
export async function listReports(): Promise<ReportListed[]> {
  const rows = await getDb()
    .select({ report, eventSlug: event.slug, eventCustomSlug: event.customSlug, eventState: event.state })
    .from(report)
    .leftJoin(event, eq(event.id, report.eventId))
    .orderBy(sql`(${report.handledAt} is not null or ${report.eventId} is null)`, desc(report.createdAt), asc(report.id));
  return rows.map((row) => ({ ...row.report, eventSlug: row.eventSlug, eventCustomSlug: row.eventCustomSlug, eventState: row.eventState }));
}

// How many reports are waiting, for the link on the instance settings page. A report whose event
// is gone counts as handled, whoever deleted the event.
export async function countUnhandledReports(): Promise<number> {
  const [row] = await getDb().select({ reports: sql<number>`count(*)::int` }).from(report).where(and(isNull(report.handledAt), isNotNull(report.eventId)));
  return row.reports;
}

export async function markReportHandled(id: string): Promise<void> {
  await getDb().update(report).set({ handledAt: new Date() }).where(and(eq(report.id, id), isNull(report.handledAt)));
}

// The operator may delete any event: the same removal as the host's own, and every report about it
// is handled by it. The reports are found first and marked once the event is gone, by id, since its
// going leaves them with no event to be found by; a removal that fails leaves them as they were.
export async function deleteEventAsOperator(eventId: string): Promise<void> {
  const waiting = await getDb().select({ id: report.id }).from(report).where(and(eq(report.eventId, eventId), isNull(report.handledAt)));
  await removeEvents(eq(event.id, eventId));
  if (waiting.length > 0) await getDb().update(report).set({ handledAt: new Date() }).where(inArray(report.id, waiting.map(({ id }) => id)));
}
