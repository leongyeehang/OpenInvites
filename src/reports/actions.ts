"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireOperator } from "@/auth/session";
import { findEventBySlug } from "@/events/repository";
import { isSlug } from "@/events/slug";
import { isUuid } from "@/lib/uuid";
import { consume } from "@/rate-limit/rate-limit";
import { notifyOperatorOfReport } from "./notify-operator";
import { parseReport, type ReportError } from "./report";
import { createReport, deleteEventAsOperator, markReportHandled } from "./repository";

// Why a report was refused. The reporter's own browser turns it into a sentence. Closed is an event
// that is gone, or a draft; too fast is the rate limit. What was typed comes back with a refusal, so
// the form keeps it.
export type ReportRefusal = ReportError | "closed" | "tooFast";

export type ReportState = { error?: ReportRefusal; sent?: true; reason?: string; contact?: string } | undefined;

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

// Sending a report: counted against the report limit before anything is looked up, then stored and
// told to the operator. A published or a cancelled event can be reported; nothing says whether a
// draft exists.
export async function sendReportAction(slug: string, _: ReportState, formData: FormData): Promise<ReportState> {
  const typed = { reason: text(formData, "reason"), contact: text(formData, "contact") };
  if (!(await consume("report", await headers())).allowed) return { error: "tooFast", ...typed };
  const event = isSlug(slug) ? await findEventBySlug(slug) : undefined;
  if (!event || event.state === "draft") return { error: "closed", ...typed };

  const parsed = parseReport(typed);
  if (!parsed.ok) return { error: parsed.error, ...typed };

  await createReport(event, parsed);
  await notifyOperatorOfReport(event, parsed);
  return { sent: true };
}

// The operator's two buttons on a report. Both are the operator's alone; anyone else is told the
// page does not exist.
export async function markReportHandledAction(id: string): Promise<void> {
  await requireOperator();
  if (!isUuid(id)) return;
  await markReportHandled(id);
  revalidatePath("/instance/reports");
  revalidatePath("/instance");
}

export async function deleteReportedEventAction(eventId: string): Promise<void> {
  await requireOperator();
  if (!isUuid(eventId)) return;
  await deleteEventAsOperator(eventId);
  revalidatePath("/instance/reports");
  revalidatePath("/instance");
}
