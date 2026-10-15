import { describe, expect, it } from "vitest";
import type { Question } from "@/questions/question";
import { threadMessages, threadTurns, type Bubble, type ThreadEvent, type ThreadReply } from "./thread-script";

const allergies: Question = { id: "q1", type: "text", prompt: "Any allergies?", options: [], required: false };
const games: Question = { id: "q2", type: "multiple", prompt: "Which games?", options: ["Tag", "Treasure hunt", "Piñata"], required: true };
const pudding: Question = { id: "q3", type: "choice", prompt: "Cake or ice cream?", options: ["Cake", "Ice cream"], required: true };
const staying: Question = { id: "q4", type: "yesNo", prompt: "Staying for dinner?", options: [], required: false };

const PARTY: ThreadEvent = { settings: { plusOnesAllowed: 2, requirePlusOneNames: false, askEmail: false }, questions: [allergies, games] };

function reply(patch: Partial<ThreadReply> = {}): ThreadReply {
  return { status: "going", name: "Mei Lin Tan", email: "", plusOnes: 0, plusOneNames: [], answers: {}, ...patch };
}

// Who says what, in order, as the thread shows it.
const said = (bubbles: Bubble[]) => bubbles.map(({ from, said }) => [from, said]);

const ASK = ["host", { line: "ask" }];

describe("threadMessages", () => {
  it("opens with the ask, and nothing more until the guest answers", () => {
    expect(said(threadMessages({ step: "idle", at: 0, reply: reply() }, PARTY))).toEqual([ASK]);
  });

  it("says instead that the event takes no replies, when it is cancelled or still a draft", () => {
    expect(said(threadMessages({ step: "idle", at: 0, reply: reply() }, { ...PARTY, closed: "cancelled" }))).toEqual([["host", { line: "cancelled" }]]);
    expect(said(threadMessages({ step: "idle", at: 0, reply: reply() }, { ...PARTY, closed: "draft" }))).toEqual([["host", { line: "draft" }]]);
  });

  it("puts the guest's answer in their own words, then asks their name, gently when they can't go", () => {
    for (const status of ["going", "maybe"] as const) {
      expect(said(threadMessages({ step: "name", at: 0, reply: reply({ status }) }, PARTY))).toEqual([ASK, ["guest", { line: status }], ["host", { line: "askName" }]]);
    }
    expect(said(threadMessages({ step: "name", at: 0, reply: reply({ status: "cant" }) }, PARTY))).toEqual([
      ASK,
      ["guest", { line: "cant" }],
      ["host", { line: "askNameCant" }],
    ]);
  });

  it("greets the guest by their first name and offers as many plus-ones as the host allows", () => {
    expect(said(threadMessages({ step: "plusones", at: 0, reply: reply() }, PARTY)).slice(3)).toEqual([
      ["guest", { text: "Mei Lin Tan" }],
      ["host", { line: "askPlusOnes", values: { firstName: "Mei", max: 2 } }],
    ]);
  });

  it("asks for an email after the name when the host does, and takes a skip", () => {
    const asking: ThreadEvent = { ...PARTY, settings: { ...PARTY.settings, askEmail: true } };
    expect(said(threadMessages({ step: "name", at: 1, reply: reply() }, asking)).slice(3)).toEqual([
      ["guest", { text: "Mei Lin Tan" }],
      ["host", { line: "askEmail" }],
    ]);
    expect(said(threadMessages({ step: "plusones", at: 0, reply: reply() }, asking)).slice(5, 6)).toEqual([["guest", { line: "skipped" }]]);
    expect(said(threadMessages({ step: "plusones", at: 0, reply: reply({ email: " mei@example.com " }) }, asking)).slice(5, 6)).toEqual([
      ["guest", { text: "mei@example.com" }],
    ]);
  });

  it("asks each plus-one's name in turn when the host wants them", () => {
    const naming: ThreadEvent = { ...PARTY, settings: { ...PARTY.settings, requirePlusOneNames: true } };
    const bringing = reply({ plusOnes: 2, plusOneNames: ["Arjun", ""] });
    expect(said(threadMessages({ step: "plusones", at: 1, reply: bringing }, naming)).slice(5)).toEqual([
      ["guest", { line: "bringing", values: { count: 2 } }],
      ["host", { line: "askGuestName", values: { number: 1 } }],
    ]);
    expect(said(threadMessages({ step: "plusones", at: 2, reply: bringing }, naming)).slice(7)).toEqual([
      ["guest", { text: "Arjun" }],
      ["host", { line: "askGuestName", values: { number: 2 } }],
    ]);
  });

  it("says Just me for a guest who brings nobody, and asks no names", () => {
    const naming: ThreadEvent = { ...PARTY, settings: { ...PARTY.settings, requirePlusOneNames: true } };
    expect(said(threadMessages({ step: "questions", at: 0, reply: reply() }, naming)).slice(5)).toEqual([
      ["guest", { rsvp: "plusOnes.justMe" }],
      ["host", { line: "questionOptional", values: { prompt: "Any allergies?" } }],
    ]);
  });

  it("asks the questions one at a time, an optional one with its skip, and answers each as the guest did", () => {
    const answers = { q1: ["  "], q2: ["Treasure hunt", "Tag"] };
    // Both answered: the RSVP is on its way, and the host has not replied yet.
    expect(said(threadMessages({ step: "questions", at: 2, reply: reply({ answers }) }, PARTY)).slice(5)).toEqual([
      ["guest", { rsvp: "plusOnes.justMe" }],
      ["host", { line: "questionOptional", values: { prompt: "Any allergies?" } }],
      ["guest", { line: "skipped" }],
      ["host", { text: "Which games?" }],
      ["guest", { list: ["Tag", "Treasure hunt"] }],
    ]);
    expect(said(threadMessages({ step: "questions", at: 1, reply: reply({ answers: { q1: ["Peanuts"] } }) }, PARTY)).slice(7)).toEqual([
      ["guest", { text: "Peanuts" }],
      ["host", { text: "Which games?" }],
    ]);
  });

  it("answers a single choice with the option, and yes or no in the guest's language", () => {
    const asking: ThreadEvent = { settings: { plusOnesAllowed: 0, requirePlusOneNames: false, askEmail: false }, questions: [pudding, staying] };
    const answers = { q3: ["Ice cream"], q4: ["yes"] };
    expect(said(threadMessages({ step: "questions", at: 2, reply: reply({ answers }) }, asking)).slice(3)).toEqual([
      ["guest", { text: "Mei Lin Tan" }],
      ["host", { text: "Cake or ice cream?" }],
      ["guest", { text: "Ice cream" }],
      ["host", { line: "questionOptional", values: { prompt: "Staying for dinner?" } }],
      ["guest", { rsvp: "questions.yes" }],
    ]);
  });

  it("ends a saved RSVP with the done bubble, by the guest's first name", () => {
    const answers = { q1: ["Peanuts"], q2: ["Tag"] };
    for (const status of ["going", "maybe"] as const) {
      const bubbles = threadMessages({ step: "done", at: 0, reply: reply({ status, plusOnes: 1, answers }) }, PARTY);
      expect(said(bubbles)).toEqual([
        ASK,
        ["guest", { line: status }],
        ["host", { line: "askName" }],
        ["guest", { text: "Mei Lin Tan" }],
        ["host", { line: "askPlusOnes", values: { firstName: "Mei", max: 2 } }],
        ["guest", { line: "bringing", values: { count: 1 } }],
        ["host", { line: "questionOptional", values: { prompt: "Any allergies?" } }],
        ["guest", { text: "Peanuts" }],
        ["host", { text: "Which games?" }],
        ["guest", { list: ["Tag"] }],
        ["host", { line: `done.${status}`, values: { firstName: "Mei" } }],
      ]);
      expect(bubbles.at(-1)?.done).toBe(true);
      expect(bubbles.filter((bubble) => bubble.done)).toHaveLength(1);
    }
  });

  it("asks a guest who can't go nothing but their name before the done bubble", () => {
    expect(said(threadMessages({ step: "done", at: 0, reply: reply({ status: "cant", name: "Priya" }) }, PARTY))).toEqual([
      ASK,
      ["guest", { line: "cant" }],
      ["host", { line: "askNameCant" }],
      ["guest", { text: "Priya" }],
      ["host", { line: "done.cant", values: { firstName: "Priya" } }],
    ]);
  });

  it("goes from the name to the questions when the host allows no plus-ones, and stops once the last answer is given", () => {
    const noGuests: ThreadEvent = { ...PARTY, settings: { ...PARTY.settings, plusOnesAllowed: 0 } };
    expect(said(threadMessages({ step: "questions", at: 0, reply: reply() }, noGuests)).slice(3)).toEqual([
      ["guest", { text: "Mei Lin Tan" }],
      ["host", { line: "questionOptional", values: { prompt: "Any allergies?" } }],
    ]);
    const nameOnly: ThreadEvent = { settings: { plusOnesAllowed: 0, requirePlusOneNames: false, askEmail: false }, questions: [] };
    expect(said(threadMessages({ step: "name", at: 1, reply: reply() }, nameOnly))).toEqual([
      ASK,
      ["guest", { line: "going" }],
      ["host", { line: "askName" }],
      ["guest", { text: "Mei Lin Tan" }],
    ]);
  });

  it("keeps a guest's conversation on an event that has since closed, and says so after it", () => {
    const bubbles = threadMessages({ step: "done", at: 0, reply: reply({ status: "cant" }) }, { ...PARTY, closed: "cancelled" });
    expect(said(bubbles)[0]).toEqual(ASK);
    expect(said(bubbles).slice(-2)).toEqual([
      ["host", { line: "done.cant", values: { firstName: "Mei" } }],
      ["host", { line: "cancelled" }],
    ]);
  });

  it("gives every bubble its own key", () => {
    const everything: ThreadEvent = { settings: { plusOnesAllowed: 2, requirePlusOneNames: true, askEmail: true }, questions: [allergies, games, pudding, staying] };
    const keys = threadMessages({ step: "done", at: 0, reply: reply({ plusOnes: 2, plusOneNames: ["Arjun", "Mei"] }) }, everything).map((bubble) => bubble.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toHaveLength(2 + 2 * (2 + 3 + 4) + 1);
  });
});

describe("threadTurns", () => {
  it("lists what each step asks, one thing at a time, in order", () => {
    const everything: ThreadEvent = { settings: { plusOnesAllowed: 2, requirePlusOneNames: true, askEmail: true }, questions: [allergies, games] };
    const turns = threadTurns(reply({ plusOnes: 2 }), everything);
    expect(turns.map(({ step, at, asks }) => [step, at, asks.kind])).toEqual([
      ["name", 0, "name"],
      ["name", 1, "email"],
      ["plusones", 0, "plusOnes"],
      ["plusones", 1, "guestName"],
      ["plusones", 2, "guestName"],
      ["questions", 0, "question"],
      ["questions", 1, "question"],
    ]);
    // A guest who can't go is asked their name, and their email when the host wants it.
    expect(threadTurns(reply({ status: "cant" }), everything).map(({ asks }) => asks.kind)).toEqual(["name", "email"]);
  });
});
