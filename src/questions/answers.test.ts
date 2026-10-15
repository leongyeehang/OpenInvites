import { describe, expect, it } from "vitest";
import { answerAfterPicking, answersStillOffered, parseAnswers } from "./answers";
import type { Question } from "./question";

const dietary: Question = { id: "q1", type: "text", prompt: "Any dietary needs?", options: [], required: false };
const starter: Question = { id: "q2", type: "choice", prompt: "Starter?", options: ["Soup", "Salad"], required: true };
const staying: Question = { id: "q3", type: "yesNo", prompt: "Staying over?", options: [], required: false };
const sessions: Question = { id: "q4", type: "multiple", prompt: "Which sessions?", options: ["Keynote", "Workshop", "Panel"], required: false };
const questions = [dietary, starter, staying];

describe("parseAnswers", () => {
  it("keeps the answers a guest gave, in the order the host arranged the questions", () => {
    expect(parseAnswers({ q2: ["Soup"], q1: ["  No nuts  "], q3: ["yes"] }, questions, "going")).toEqual({
      ok: true,
      answers: [
        { questionId: "q1", values: ["No nuts"] },
        { questionId: "q2", values: ["Soup"] },
        { questionId: "q3", values: ["yes"] },
      ],
    });
  });

  it("asks nothing of a guest who can't go", () => {
    expect(parseAnswers({}, questions, "cant")).toEqual({ ok: true, answers: [] });
  });

  it("insists on the required ones, and only those", () => {
    expect(parseAnswers({ q2: ["  "] }, questions, "going")).toEqual({ ok: false, error: "answerRequired" });
    expect(parseAnswers({ q2: ["Soup"] }, questions, "going")).toEqual({ ok: true, answers: [{ questionId: "q2", values: ["Soup"] }] });
  });

  it("takes only an answer the question actually offers", () => {
    expect(parseAnswers({ q2: ["Steak"] }, questions, "going")).toEqual({ ok: false, error: "answerNotOffered" });
    expect(parseAnswers({ q2: ["Soup"], q3: ["perhaps"] }, questions, "going")).toEqual({ ok: false, error: "answerNotOffered" });
  });

  it("ignores an answer to a question this event does not ask", () => {
    const parsed = parseAnswers({ q2: ["Soup"], somewhereElse: ["sneaky"] }, questions, "going");
    expect(parsed.ok && parsed.answers).toEqual([{ questionId: "q2", values: ["Soup"] }]);
  });

  it("refuses an essay where a sentence was asked for", () => {
    expect(parseAnswers({ q1: ["a".repeat(501)], q2: ["Soup"] }, questions, "going")).toEqual({
      ok: false,
      error: "answerTooLong",
    });
  });
});

describe("answersStillOffered", () => {
  it("drops an answer the question no longer offers, so a guest is never locked out", () => {
    const rewritten = { ...starter, options: ["Soup", "Bread"] };
    expect(answersStillOffered({ q1: ["No nuts"], q2: ["Salad"], q3: ["yes"] }, [dietary, rewritten, staying])).toEqual({
      q1: ["No nuts"],
      q3: ["yes"],
    });
  });

  it("forgets an answer to a question the host has removed", () => {
    expect(answersStillOffered({ q1: ["No nuts"], q2: ["Soup"] }, [dietary])).toEqual({ q1: ["No nuts"] });
  });

  it("keeps the rest of several picks when the host removes one option", () => {
    const rewritten = { ...sessions, options: ["Keynote", "Panel"] };
    expect(answersStillOffered({ q4: ["Keynote", "Workshop", "Panel"] }, [rewritten])).toEqual({ q4: ["Keynote", "Panel"] });
  });

  it("forgets a multiple answer once none of its picks is offered", () => {
    expect(answersStillOffered({ q4: ["Workshop"] }, [{ ...sessions, options: ["Keynote"] }])).toEqual({});
  });
});

describe("parseAnswers for multiple choice", () => {
  it("takes any number of picks, stored in the order the question offers them", () => {
    expect(parseAnswers({ q4: ["Panel", "Keynote"] }, [sessions], "going")).toEqual({
      ok: true,
      answers: [{ questionId: "q4", values: ["Keynote", "Panel"] }],
    });
  });

  it("counts a pick once however often it was posted", () => {
    expect(parseAnswers({ q4: ["Panel", "Panel"] }, [sessions], "going")).toEqual({
      ok: true,
      answers: [{ questionId: "q4", values: ["Panel"] }],
    });
  });

  it("refuses a pick the question does not offer", () => {
    expect(parseAnswers({ q4: ["Keynote", "Lunch"] }, [sessions], "going")).toEqual({ ok: false, error: "answerNotOffered" });
  });

  it("means at least one pick when required, and none is an answer when it is not", () => {
    const required = { ...sessions, required: true };
    expect(parseAnswers({}, [required], "going")).toEqual({ ok: false, error: "answerRequired" });
    expect(parseAnswers({ q4: [] }, [required], "going")).toEqual({ ok: false, error: "answerRequired" });
    expect(parseAnswers({ q4: ["Panel"] }, [required], "going")).toEqual({
      ok: true,
      answers: [{ questionId: "q4", values: ["Panel"] }],
    });
    expect(parseAnswers({ q4: [] }, [sessions], "going")).toEqual({ ok: true, answers: [] });
  });

  it("allows only one value for the other types", () => {
    expect(parseAnswers({ q2: ["Soup", "Salad"] }, questions, "going")).toEqual({ ok: false, error: "answerNotOffered" });
    expect(parseAnswers({ q1: ["a", "b"], q2: ["Soup"] }, questions, "going")).toEqual({ ok: false, error: "answerNotOffered" });
  });
});

describe("answerAfterPicking", () => {
  it("makes the option the answer to a single choice, in place of the one before", () => {
    expect(answerAfterPicking(starter, [], "Soup")).toEqual(["Soup"]);
    expect(answerAfterPicking(starter, ["Soup"], "Salad")).toEqual(["Salad"]);
    expect(answerAfterPicking(staying, ["no"], "yes")).toEqual(["yes"]);
  });

  it("takes the answer back when the chosen option of an optional question is picked again, and keeps it on a required one", () => {
    expect(answerAfterPicking(staying, ["yes"], "yes")).toEqual([]);
    expect(answerAfterPicking({ ...starter, required: false }, ["Soup"], "Soup")).toEqual([]);
    expect(answerAfterPicking(starter, ["Soup"], "Soup")).toEqual(["Soup"]);
  });

  it("adds a pick to a multiple choice, or takes it away, and leaves the others as they were", () => {
    expect(answerAfterPicking(sessions, [], "Panel")).toEqual(["Panel"]);
    expect(answerAfterPicking(sessions, ["Panel"], "Keynote")).toEqual(["Panel", "Keynote"]);
    expect(answerAfterPicking(sessions, ["Panel", "Keynote"], "Panel")).toEqual(["Keynote"]);
    expect(answerAfterPicking({ ...sessions, required: true }, ["Panel"], "Panel")).toEqual([]);
  });
});
