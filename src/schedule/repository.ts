import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { event, scheduleItem } from "@/db/schema";
import type { ScheduleEntry, ScheduleItem, ScheduleRefresh } from "./schedule";

// A time as Postgres gives it ("19:00:00"), as the host typed it ("19:00").
const hhmm = (value: string) => value.slice(0, 5);

// An event's schedule, in day-and-time order.
export async function listSchedule(eventId: string): Promise<ScheduleItem[]> {
  const rows = await getDb()
    .select({
      id: scheduleItem.id,
      day: scheduleItem.day,
      startTime: scheduleItem.startTime,
      endTime: scheduleItem.endTime,
      title: scheduleItem.title,
      place: scheduleItem.place,
      note: scheduleItem.note,
    })
    .from(scheduleItem)
    .where(eq(scheduleItem.eventId, eventId))
    .orderBy(asc(scheduleItem.position));
  return rows.map((row) => ({ ...row, startTime: hhmm(row.startTime), endTime: row.endTime ? hhmm(row.endTime) : null }));
}

// Saves the schedule as a whole, replacing what the event had, with how guests' pages pick it up.
export async function saveSchedule(eventId: string, items: ScheduleEntry[], refresh: ScheduleRefresh): Promise<void> {
  await getDb().transaction(async (tx) => {
    await tx.delete(scheduleItem).where(eq(scheduleItem.eventId, eventId));
    if (items.length > 0) await tx.insert(scheduleItem).values(items.map((item) => ({ eventId, ...item })));
    await tx.update(event).set({ scheduleRefresh: refresh, updatedAt: new Date() }).where(eq(event.id, eventId));
  });
}
