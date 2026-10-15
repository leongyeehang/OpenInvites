import { describe, expect, it } from "vitest";
import { choicesFrom, MAX_QUESTIONS, parseQuestions, type QuestionDraft } from "./question";

const text: QuestionDraft = { type: "text", prompt: "Any dietary needs?", options: [], required: false };
const choice: QuestionDraft = { type: "choice", prompt: "Starter?", options: ["Soup", "Salad"], required: true };

describe("parseQuestions", () => {
  it("numbers the questions by the order the host arranged them in", () => {
    expect(parseQuestions([choice, text])).toEqual({
      ok: true,
      questions: [
        { id: undefined, type: "choice", prompt: "Starter?", options: ["Soup", "Salad"], required: true, position: 0 },
        { id: undefined, type: "text", prompt: "Any dietary needs?", options: [], required: false, position: 1 },
      ],
    });
  });

  it("keeps the id of a question the event already has, so editing is not deleting", () => {
    const id = "0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b";
    const parsed = parseQuestions([{ ...text, id }]);
    expect(parsed.ok && parsed.questions[0].id).toBe(id);
  });

  it("refuses an id that could never name a question", () => {
    expect(parseQuestions([{ ...text, id: "'; drop table question; --" }])).toEqual({
      ok: false,
      error: "questionsInvalid",
    });
  });

  it("wants a prompt, and a type it knows", () => {
    expect(parseQuestions([{ ...text, prompt: "  " }])).toEqual({ ok: false, error: "questionPromptRequired" });
    expect(parseQuestions([{ ...text, type: "essay" }])).toEqual({ ok: false, error: "questionTypeInvalid" });
    expect(parseQuestions([{ ...text, prompt: "a".repeat(201) }])).toEqual({ ok: false, error: "questionPromptTooLong" });
  });

  it("gives choices only to a choice question, and never fewer than two", () => {
    expect(parseQuestions([{ ...choice, options: ["Soup"] }])).toEqual({ ok: false, error: "questionChoicesRequired" });
    expect(parseQuestions([{ ...choice, options: ["Soup", " ", "Salad"] }])).toEqual({
      ok: true,
      questions: [{ id: undefined, type: "choice", prompt: "Starter?", options: ["Soup", "Salad"], required: true, position: 0 }],
    });
    // A yes-or-no question's answers are not the host's to write.
    const parsed = parseQuestions([{ type: "yesNo", prompt: "Staying over?", options: ["Yes", "No", "Maybe"], required: false }]);
    expect(parsed.ok && parsed.questions[0].options).toEqual([]);
  });

  it("gives a multiple-choice question its options under the same limits as a choice", () => {
    const multiple: QuestionDraft = { type: "multiple", prompt: "Sessions?", options: ["Keynote", " ", "Panel"], required: true };
    expect(parseQuestions([multiple])).toEqual({
      ok: true,
      questions: [{ id: undefined, type: "multiple", prompt: "Sessions?", options: ["Keynote", "Panel"], required: true, position: 0 }],
    });
    expect(parseQuestions([{ ...multiple, options: ["Keynote"] }])).toEqual({ ok: false, error: "questionChoicesRequired" });
    expect(parseQuestions([{ ...multiple, options: Array.from({ length: 11 }, (_, i) => `o${i}`) }])).toEqual({
      ok: false,
      error: "questionChoicesRequired",
    });
    expect(parseQuestions([{ ...multiple, options: ["Keynote", "a".repeat(81)] }])).toEqual({ ok: false, error: "questionChoiceTooLong" });
  });

  it("refuses anything that is not a list of questions", () => {
    expect(parseQuestions("[]")).toEqual({ ok: false, error: "questionsInvalid" });
    expect(parseQuestions([{ prompt: "No type" }])).toEqual({ ok: false, error: "questionsInvalid" });
    expect(parseQuestions([])).toEqual({ ok: true, questions: [] });
  });

  it("keeps the form short", () => {
    const many = Array.from({ length: MAX_QUESTIONS + 1 }, () => text);
    expect(parseQuestions(many)).toEqual({ ok: false, error: "tooManyQuestions" });
  });
});

describe("choicesFrom", () => {
  it("reads the choices a host types, separated by commas, Chinese ones included", () => {
    expect(choicesFrom("Soup, Salad,Neither")).toEqual(["Soup", "Salad", "Neither"]);
    expect(choicesFrom("汤，沙拉、都不要")).toEqual(["汤", "沙拉", "都不要"]);
    // A comma just typed leaves room for the next choice.
    expect(choicesFrom("湯，")).toEqual(["湯", ""]);
  });
});
