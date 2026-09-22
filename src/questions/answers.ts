import type { RsvpStatus } from "@/rsvps/form";
import type { Question } from "./question";

// One guest's answer to one question. Answers belong to an RSVP and are the host's to read
// alone (spec, "Events and RSVPs").
export type Answer = { questionId: string; value: string };

// What the RSVP form posts: an answer against each question's id.
export type AnswerFields = Record<string, string>;

export type AnswerError = "answerRequired" | "answerNotOffered" | "answerTooLong";

export type ParsedAnswers = { ok: true; answers: Answer[] } | { ok: false; error: AnswerError };

// Long enough for a song request and a list of allergies.
export const MAX_ANSWER = 500;

// What a yes-or-no question offers. The host does not write these, so they live here.
export const YES_OR_NO = ["yes", "no"];

// The answers a question will accept, or null when a guest may write their own.
export function offeredBy(question: Question): string[] | null {
  if (question.type === "choice") return question.options;
  return question.type === "yesNo" ? YES_OR_NO : null;
}

// The rules of the questions step (ticket 09). Walking the host's questions rather than what
// was posted means an answer to a question this event does not ask is simply not an answer,
// and the result comes back in the order the host arranged.
export function parseAnswers(given: AnswerFields, questions: Question[], status: RsvpStatus): ParsedAnswers {
  // Declining takes two taps: a guest who can't go is asked nothing (spec, story 69).
  if (status === "cant") return { ok: true, answers: [] };

  const answers: Answer[] = [];
  for (const question of questions) {
    const value = (given[question.id] ?? "").trim();
    if (!value) {
      if (question.required) return { ok: false, error: "answerRequired" };
      continue;
    }
    if (value.length > MAX_ANSWER) return { ok: false, error: "answerTooLong" };

    const offered = offeredBy(question);
    if (offered && !offered.includes(value)) return { ok: false, error: "answerNotOffered" };

    answers.push({ questionId: question.id, value });
  }
  return { ok: true, answers };
}

// The answers still worth showing a guest who comes back. A host may have rewritten a question's
// choices or changed its kind since, and an answer nobody offers any more would ride along in a
// hidden field and refuse every save, locking the guest out of their own RSVP.
export function answersStillOffered(stored: AnswerFields, questions: Question[]): AnswerFields {
  const kept: AnswerFields = {};
  for (const question of questions) {
    const value = stored[question.id];
    const offered = offeredBy(question);
    if (value && (!offered || offered.includes(value))) kept[question.id] = value;
  }
  return kept;
}
