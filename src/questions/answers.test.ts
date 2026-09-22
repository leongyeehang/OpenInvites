import { describe, expect, it } from "vitest";
import { answersStillOffered, parseAnswers } from "./answers";
import type { Question } from "./question";

const dietary: Question = { id: "q1", type: "text", prompt: "Any dietary needs?", options: [], required: false };
const starter: Question = { id: "q2", type: "choice", prompt: "Starter?", options: ["Soup", "Salad"], required: true };
const staying: Question = { id: "q3", type: "yesNo", prompt: "Staying over?", options: [], required: false };
const questions = [dietary, starter, staying];

describe("parseAnswers", () => {
  it("keeps the answers a guest gave, in the order the host arranged the questions", () => {
    expect(parseAnswers({ q2: "Soup", q1: "  No nuts  ", q3: "yes" }, questions, "going")).toEqual({
      ok: true,
      answers: [
        { questionId: "q1", value: "No nuts" },
        { questionId: "q2", value: "Soup" },
        { questionId: "q3", value: "yes" },
      ],
    });
  });

  it("asks nothing of a guest who can't go", () => {
    expect(parseAnswers({}, questions, "cant")).toEqual({ ok: true, answers: [] });
  });

  it("insists on the required ones, and only those", () => {
    expect(parseAnswers({ q2: "  " }, questions, "going")).toEqual({ ok: false, error: "answerRequired" });
    expect(parseAnswers({ q2: "Soup" }, questions, "going")).toEqual({ ok: true, answers: [{ questionId: "q2", value: "Soup" }] });
  });

  it("takes only an answer the question actually offers", () => {
    expect(parseAnswers({ q2: "Steak" }, questions, "going")).toEqual({ ok: false, error: "answerNotOffered" });
    expect(parseAnswers({ q2: "Soup", q3: "perhaps" }, questions, "going")).toEqual({ ok: false, error: "answerNotOffered" });
  });

  it("ignores an answer to a question this event does not ask", () => {
    const parsed = parseAnswers({ q2: "Soup", somewhereElse: "sneaky" }, questions, "going");
    expect(parsed.ok && parsed.answers).toEqual([{ questionId: "q2", value: "Soup" }]);
  });

  it("refuses an essay where a sentence was asked for", () => {
    expect(parseAnswers({ q1: "a".repeat(501), q2: "Soup" }, questions, "going")).toEqual({
      ok: false,
      error: "answerTooLong",
    });
  });
});

describe("answersStillOffered", () => {
  it("drops an answer the question no longer offers, so a guest is never locked out", () => {
    const rewritten = { ...starter, options: ["Soup", "Bread"] };
    expect(answersStillOffered({ q1: "No nuts", q2: "Salad", q3: "yes" }, [dietary, rewritten, staying])).toEqual({
      q1: "No nuts",
      q3: "yes",
    });
  });

  it("forgets an answer to a question the host has removed", () => {
    expect(answersStillOffered({ q1: "No nuts", q2: "Soup" }, [dietary])).toEqual({ q1: "No nuts" });
  });
});
