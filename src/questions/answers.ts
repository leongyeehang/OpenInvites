import type { RsvpStatus } from "@/rsvps/form";
import type { Question } from "./question";

// One guest's answer to one question: the values they gave, at most one for every type but
// multiple choice, where each pick is a value. Answers belong to an RSVP and are the host's to
// read alone (spec, "Events and RSVPs").
export type Answer = { questionId: string; values: string[] };

// What the RSVP form posts: the values given against each question's id.
export type AnswerFields = Record<string, string[]>;

export type AnswerError = "answerRequired" | "answerNotOffered" | "answerTooLong";

export type ParsedAnswers = { ok: true; answers: Answer[] } | { ok: false; error: AnswerError };

// Long enough for a song request and a list of allergies.
export const MAX_ANSWER = 500;

// What a yes-or-no question offers. The host does not write these, so they live here.
export const YES_OR_NO = ["yes", "no"];

// The answers a question will accept, or null when a guest may write their own.
export function offeredBy(question: Question): string[] | null {
  if (question.type === "choice" || question.type === "multiple") return question.options;
  return question.type === "yesNo" ? YES_OR_NO : null;
}

// What a guest's answer becomes when they pick one of a question's options, whichever layout
// they pick it in. A multiple-choice pick is added, or taken back if it was there. Any other
// option becomes the answer; picking the chosen one again takes it back, which is the only way to
// leave an optional question unanswered, and a required one keeps it.
export function answerAfterPicking(question: Question, given: string[], option: string): string[] {
  const chosen = given.includes(option);
  if (question.type === "multiple") return chosen ? given.filter((each) => each !== option) : [...given, option];
  return chosen && !question.required ? [] : [option];
}

// The rules of the questions step (ticket 09). Walking the host's questions rather than what
// was posted means an answer to a question this event does not ask is simply not an answer,
// and the result comes back in the order the host arranged.
export function parseAnswers(given: AnswerFields, questions: Question[], status: RsvpStatus): ParsedAnswers {
  // Declining takes two taps: a guest who can't go is asked nothing (spec, story 69).
  if (status === "cant") return { ok: true, answers: [] };

  const answers: Answer[] = [];
  for (const question of questions) {
    const values = (given[question.id] ?? []).map((value) => value.trim()).filter(Boolean);
    if (values.length === 0) {
      if (question.required) return { ok: false, error: "answerRequired" };
      continue;
    }
    if (values.some((value) => value.length > MAX_ANSWER)) return { ok: false, error: "answerTooLong" };

    const offered = offeredBy(question);
    if (question.type === "multiple") {
      // Each pick counts once, and reads in the order the question offers them.
      if (values.some((value) => !offered?.includes(value))) return { ok: false, error: "answerNotOffered" };
      answers.push({ questionId: question.id, values: (offered ?? []).filter((option) => values.includes(option)) });
      continue;
    }

    if (values.length > 1) return { ok: false, error: "answerNotOffered" };
    if (offered && !offered.includes(values[0])) return { ok: false, error: "answerNotOffered" };
    answers.push({ questionId: question.id, values: values });
  }
  return { ok: true, answers };
}

// The answers still worth showing a guest who comes back. A host may have rewritten a question's
// choices or changed its kind since, and an answer nobody offers any more would ride along in a
// hidden field and refuse every save, locking the guest out of their own RSVP. Each value the
// question no longer offers is dropped and the rest are kept.
export function answersStillOffered(stored: AnswerFields, questions: Question[]): AnswerFields {
  const kept: AnswerFields = {};
  for (const question of questions) {
    const offered = offeredBy(question);
    const values = (stored[question.id] ?? []).filter((value) => !offered || offered.includes(value));
    if (values.length > 0) kept[question.id] = values;
  }
  return kept;
}
