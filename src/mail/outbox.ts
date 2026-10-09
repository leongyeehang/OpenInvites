import { asc, eq, lte } from "drizzle-orm";
import { getDb, type Db } from "@/db/client";
import { mailOutbox } from "@/db/schema";
import { nextAttempt } from "./retry";
import { sendMail } from "./send";

// One email about an event, written whole when it is queued: whoever reads it later has no
// request to translate it in.
export type QueuedMail = { eventId: string | null; to: string; subject: string; text: string };

// Every email about an event goes out through here rather than through sendMail (spec, "Mail
// outbox and worker"). Callers check isMailConfigured() first, and kick the worker once queued. A
// caller can queue inside its own transaction (the reminders, with the mark that they were sent).
export async function queueMail(rows: QueuedMail[], db: Db = getDb()): Promise<void> {
  if (rows.length === 0) return;
  await db.insert(mailOutbox).values(rows);
}

// Sends every message due by now, oldest first, until none is left. Each is claimed in a
// transaction of its own with SKIP LOCKED, so two app containers on one database never send the
// same message, and a crash part way through sends again at most the one it was on.
export async function sendDue(now: Date): Promise<void> {
  let more = true;
  while (more) more = await sendOne(now);
}

async function sendOne(now: Date): Promise<boolean> {
  return getDb().transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(mailOutbox)
      .where(lte(mailOutbox.sendAfter, now))
      .orderBy(asc(mailOutbox.sendAfter), asc(mailOutbox.id))
      .limit(1)
      .for("update", { skipLocked: true });
    if (!row) return false;

    const failure = await sendMail({ to: row.to, subject: row.subject, text: row.text }).then(
      () => null,
      (error: unknown) => (error instanceof Error ? error.message : String(error)),
    );
    if (failure === null) {
      await tx.delete(mailOutbox).where(eq(mailOutbox.id, row.id));
      return true;
    }
    const attempts = row.attempts + 1;
    const retryAt = nextAttempt(attempts, now);
    if (retryAt) {
      await tx.update(mailOutbox).set({ attempts, lastError: failure, sendAfter: retryAt }).where(eq(mailOutbox.id, row.id));
      return true;
    }
    await tx.delete(mailOutbox).where(eq(mailOutbox.id, row.id));
    // The log keeps who it was for only to their domain, which is enough to see a pattern.
    const redacted = `…${row.to.slice(row.to.lastIndexOf("@"))}`;
    console.error(`Mail: gave up on a message to ${redacted} after ${attempts} attempts: ${failure.replaceAll(row.to, redacted)}`);
    return true;
  });
}
