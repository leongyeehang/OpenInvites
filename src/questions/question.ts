// A prompt the host adds to an event that guests answer while responding (CONTEXT.md,
// "Question"). Free text, one choice from a list, several choices from a list, or yes or no.
export const QUESTION_TYPES = ["text", "choice", "multiple", "yesNo"] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];

// Enough for dietary needs and a song request without turning an invitation into a form.
export const MAX_QUESTIONS = 10;
export const MAX_PROMPT = 200;
export const MAX_OPTION = 80;
export const MAX_OPTIONS = 10;

// What the host's editor posts, before any of it is trusted. An existing question carries its
// id; a new one does not.
export type QuestionDraft = {
  id?: string;
  type: string;
  prompt: string;
  options: string[];
  required: boolean;
};

// One question, once trusted. Its position is where it sits in the list the host arranged.
export type QuestionInput = {
  id?: string;
  type: QuestionType;
  prompt: string;
  options: string[];
  required: boolean;
  position: number;
};

// A question as the event stores it, which is what a guest is asked and what an answer is
// checked against.
export type Question = {
  id: string;
  type: QuestionType;
  prompt: string;
  options: string[];
  required: boolean;
};

// The choices of a question as the host types them into the editor, one after another: split on
// commas, the ASCII one and the two Chinese is typed with (，and 、).
export function choicesFrom(typed: string): string[] {
  return typed.split(/[,，、]/).map((choice) => choice.trim());
}

export type QuestionError =
  | "questionsInvalid"
  | "questionTypeInvalid"
  | "questionPromptRequired"
  | "questionPromptTooLong"
  | "questionChoicesRequired"
  | "questionChoiceTooLong"
  | "tooManyQuestions";

export type ParsedQuestions = { ok: true; questions: QuestionInput[] } | { ok: false; error: QuestionError };

// Reads a draft the editor wrote, knob by knob, so a crafted post is a refusal rather than a
// crash (the same stance parseTheme takes).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function asDraft(value: unknown): QuestionDraft | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const raw = value as Record<string, unknown>;
  if (typeof raw.type !== "string" || typeof raw.prompt !== "string") return undefined;
  // An id reaches a uuid column, so anything that is not one is refused here rather than left
  // for Postgres to throw over.
  if (raw.id !== undefined && (typeof raw.id !== "string" || !UUID.test(raw.id))) return undefined;
  const options = Array.isArray(raw.options) ? raw.options : [];
  if (options.some((option) => typeof option !== "string")) return undefined;
  return { id: raw.id, type: raw.type, prompt: raw.prompt, options: options as string[], required: raw.required === true };
}

// The rules of the questions editor (ticket 09). Order is the order the host arranged, so the
// list's own index is the position; only a choice or multiple-choice question carries options.
export function parseQuestions(posted: unknown): ParsedQuestions {
  if (!Array.isArray(posted)) return { ok: false, error: "questionsInvalid" };
  if (posted.length > MAX_QUESTIONS) return { ok: false, error: "tooManyQuestions" };

  const questions: QuestionInput[] = [];
  for (const [position, posting] of posted.entries()) {
    const draft = asDraft(posting);
    if (!draft) return { ok: false, error: "questionsInvalid" };

    const type = QUESTION_TYPES.find((each) => each === draft.type);
    if (!type) return { ok: false, error: "questionTypeInvalid" };

    const prompt = draft.prompt.trim();
    if (!prompt) return { ok: false, error: "questionPromptRequired" };
    if (prompt.length > MAX_PROMPT) return { ok: false, error: "questionPromptTooLong" };

    // Only a choice question has choices, and a choice of one is not a choice.
    const hasOptions = type === "choice" || type === "multiple";
    const options = hasOptions ? draft.options.map((option) => option.trim()).filter(Boolean) : [];
    if (hasOptions && (options.length < 2 || options.length > MAX_OPTIONS)) {
      return { ok: false, error: "questionChoicesRequired" };
    }
    if (options.some((option) => option.length > MAX_OPTION)) return { ok: false, error: "questionChoiceTooLong" };

    questions.push({ id: draft.id, type, prompt, options, required: draft.required, position });
  }
  return { ok: true, questions };
}
