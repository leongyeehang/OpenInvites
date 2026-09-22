import { and, asc, eq, notInArray, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { answer, question, rsvp } from "@/db/schema";
import type { Answer } from "./answers";
import type { Question, QuestionInput } from "./question";

// An event's questions, in the order the host arranged them.
export async function listQuestions(eventId: string): Promise<Question[]> {
  return getDb()
    .select({
      id: question.id,
      type: question.type,
      prompt: question.prompt,
      options: question.options,
      required: question.required,
    })
    .from(question)
    .where(eq(question.eventId, eventId))
    .orderBy(asc(question.position));
}

// How many answers each question already holds, so the editor can say what removing one costs.
export async function countAnswersByQuestion(eventId: string): Promise<Record<string, number>> {
  const rows = await getDb()
    .select({ questionId: answer.questionId, answers: sql<number>`count(*)::int` })
    .from(answer)
    .innerJoin(question, eq(question.id, answer.questionId))
    .where(eq(question.eventId, eventId))
    .groupBy(answer.questionId);
  return Object.fromEntries(rows.map((row) => [row.questionId, row.answers]));
}

// Saves the host's list whole: a question they dropped is removed, taking its answers with it;
// one they kept is updated where it now sits; a new one is added.
export async function saveQuestions(eventId: string, questions: QuestionInput[]): Promise<void> {
  const kept = questions.map((each) => each.id).filter((id): id is string => id !== undefined);
  await getDb().transaction(async (tx) => {
    await tx
      .delete(question)
      .where(kept.length === 0 ? eq(question.eventId, eventId) : and(eq(question.eventId, eventId), notInArray(question.id, kept)));
    for (const { id, ...values } of questions) {
      if (id) await tx.update(question).set(values).where(and(eq(question.id, id), eq(question.eventId, eventId)));
      else await tx.insert(question).values({ eventId, ...values });
    }
  });
}

// A guest's answers, replaced whole every time they answer, the way their RSVP is.
export async function saveAnswers(rsvpId: string, answers: Answer[]): Promise<void> {
  await getDb().transaction(async (tx) => {
    await tx.delete(answer).where(eq(answer.rsvpId, rsvpId));
    if (answers.length > 0) await tx.insert(answer).values(answers.map((each) => ({ rsvpId, ...each })));
  });
}

// What one guest answered, for prefilling their form when they come back to change it.
export async function findAnswers(rsvpId: string): Promise<Record<string, string>> {
  const rows = await getDb()
    .select({ questionId: answer.questionId, value: answer.value })
    .from(answer)
    .where(eq(answer.rsvpId, rsvpId));
  return Object.fromEntries(rows.map((row) => [row.questionId, row.value]));
}

export type GuestAnswer = { questionId: string; prompt: string; value: string };

// Every guest's answers for one event, for the host's guest list and nowhere else. Ordered by
// the question's position, so each guest's answers read in the order the host asked them.
export async function listAnswersByGuest(eventId: string): Promise<Record<string, GuestAnswer[]>> {
  const rows = await getDb()
    .select({ rsvpId: answer.rsvpId, questionId: answer.questionId, prompt: question.prompt, value: answer.value })
    .from(answer)
    .innerJoin(question, eq(question.id, answer.questionId))
    .innerJoin(rsvp, eq(rsvp.id, answer.rsvpId))
    .where(eq(rsvp.eventId, eventId))
    .orderBy(asc(question.position));

  const byGuest: Record<string, GuestAnswer[]> = {};
  for (const { rsvpId, ...given } of rows) (byGuest[rsvpId] ??= []).push(given);
  return byGuest;
}
