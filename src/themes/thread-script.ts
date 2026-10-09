import type { AnswerFields } from "@/questions/answers";
import type { Question } from "@/questions/question";
import type { RsvpSettings, RsvpStatus } from "@/rsvps/form";

// The Thread layout's script (spec, "Thread"): the conversation the invitation holds with the
// guest, as the bubbles of a chat. Every host line is a fixed string (EventPage.thread) keyed to
// where the guest is in the RSVP flow, and the guest's own bubbles are what they answered, so the
// host writes none of it. One turn at a time: the host asks, the guest answers, the host asks the
// next thing. The flow's rules are use-rsvp-flow.ts's; this only says what each state reads as.

// Where the guest is in the RSVP flow, as use-rsvp-flow.ts names it.
export type ThreadStep = "idle" | "name" | "plusones" | "questions" | "done";

// What the guest has said: the answer they are giving, or the one they saved.
export type ThreadReply = {
  status: RsvpStatus;
  name: string;
  email: string;
  plusOnes: number;
  plusOneNames: string[];
  answers: AnswerFields;
};

export type ThreadState = {
  step: ThreadStep;
  // The turn the step is on (threadTurns): the name or the email; how many plus-ones, then each
  // one's name; each question. One past the step's last turn, all of it is answered.
  at: number;
  reply: ThreadReply;
};

export type ThreadEvent = {
  // Why the event takes no replies, when it takes none.
  closed?: "cancelled" | "draft";
  settings: RsvpSettings;
  questions: Question[];
};

// A line of EventPage.thread, with the values it takes.
export type ThreadLine =
  | "ask"
  | "cancelled"
  | "draft"
  | RsvpStatus
  | "askName"
  | "askNameCant"
  | "askEmail"
  | "askPlusOnes"
  | "bringing"
  | "askGuestName"
  | "questionOptional"
  | "skipped"
  | `done.${RsvpStatus}`;

// What a bubble says: a line of the script; the same words as the other layouts' controls (yes,
// no, just me); something written by the guest or by the host (a name, a prompt, an option); or
// several picks, which the guest's language joins.
export type Said =
  | { line: ThreadLine; values?: Record<string, string | number> }
  | { rsvp: "questions.yes" | "questions.no" | "plusOnes.justMe" }
  | { text: string }
  | { list: string[] };

// One bubble of the conversation. The key stays the same for as long as the bubble does, so the
// layout can tell what is new. The done bubble carries the guest's private link and calendar.
export type Bubble = { key: string; from: "host" | "guest"; said: Said; done?: true };

// What a turn asks of the guest, which is what the composer offers them.
export type Asks = { kind: "name" } | { kind: "email" } | { kind: "plusOnes" } | { kind: "guestName"; number: number } | { kind: "question"; question: Question };

export type Turn = { step: ThreadStep; at: number; key: string; asks: Asks; ask: Said; answer: Said };

const SKIPPED: Said = { line: "skipped" };

// The order of the steps, which is the order of the conversation.
const STEPS: ThreadStep[] = ["idle", "name", "plusones", "questions", "done"];

// The first word of the guest's name, which the host calls them by.
export function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}

// Every turn this guest is asked, in order: the same steps the flow has (use-rsvp-flow.ts), each
// asked one thing at a time. A guest who can't go is asked only who they are.
export function threadTurns({ status, name, email, plusOnes, plusOneNames, answers }: ThreadReply, { settings, questions }: ThreadEvent): Turn[] {
  const turns: Turn[] = [
    { step: "name", at: 0, key: "name", asks: { kind: "name" }, ask: { line: status === "cant" ? "askNameCant" : "askName" }, answer: { text: name.trim() } },
  ];
  if (settings.askEmail) {
    turns.push({ step: "name", at: 1, key: "email", asks: { kind: "email" }, ask: { line: "askEmail" }, answer: email.trim() ? { text: email.trim() } : SKIPPED });
  }
  if (status === "cant") return turns;

  if (settings.plusOnesAllowed > 0) {
    turns.push({
      step: "plusones",
      at: 0,
      key: "plusOnes",
      asks: { kind: "plusOnes" },
      ask: { line: "askPlusOnes", values: { firstName: firstNameOf(name), max: settings.plusOnesAllowed } },
      answer: plusOnes === 0 ? { rsvp: "plusOnes.justMe" } : { line: "bringing", values: { count: plusOnes } },
    });
    // Each name only when the host wants them; otherwise they are not asked at all.
    if (settings.requirePlusOneNames) {
      for (let number = 1; number <= plusOnes; number++) {
        turns.push({
          step: "plusones",
          at: number,
          key: `guest:${number}`,
          asks: { kind: "guestName", number },
          ask: { line: "askGuestName", values: { number } },
          answer: { text: (plusOneNames[number - 1] ?? "").trim() },
        });
      }
    }
  }

  questions.forEach((question, at) => {
    turns.push({
      step: "questions",
      at,
      key: `question:${question.id}`,
      asks: { kind: "question", question },
      ask: question.required ? { text: question.prompt } : { line: "questionOptional", values: { prompt: question.prompt } },
      answer: answered(question, answers[question.id] ?? []),
    });
  });
  return turns;
}

// The guest's answer to a question as their bubble says it: several picks in the order the
// question offers them, as they are saved.
function answered(question: Question, values: string[]): Said {
  const given = values.map((value) => value.trim()).filter(Boolean);
  if (question.type === "multiple") {
    const picks = question.options.filter((option) => given.includes(option));
    return picks.length > 0 ? { list: picks } : SKIPPED;
  }
  if (given.length === 0) return SKIPPED;
  if (question.type === "yesNo") return { rsvp: given[0] === "yes" ? "questions.yes" : "questions.no" };
  return { text: given[0] };
}

// The conversation so far, for where the guest is: the host's ask; once they have chosen, what
// they chose, then each turn they have answered and the one they are on; once their RSVP is saved,
// the done bubble. An event that takes no replies says so in place of the ask, and after a
// conversation saved before it closed.
export function threadMessages({ step, at, reply }: ThreadState, event: ThreadEvent): Bubble[] {
  const closed: Said | undefined = event.closed && { line: event.closed };
  if (step === "idle") return [{ key: "ask", from: "host", said: closed ?? { line: "ask" } }];

  const bubbles: Bubble[] = [
    { key: "ask", from: "host", said: { line: "ask" } },
    { key: "status", from: "guest", said: { line: reply.status } },
  ];
  // Every turn of the steps before this one is answered, and this step's up to the one it is on,
  // which has the host's line and no answer yet.
  const now = STEPS.indexOf(step);
  for (const turn of threadTurns(reply, event)) {
    const then = STEPS.indexOf(turn.step);
    if (then > now) break;
    bubbles.push({ key: `ask:${turn.key}`, from: "host", said: turn.ask });
    if (then === now && turn.at === at) break;
    bubbles.push({ key: `answer:${turn.key}`, from: "guest", said: turn.answer });
  }
  if (step !== "done") return bubbles;

  bubbles.push({ key: "done", from: "host", said: { line: `done.${reply.status}`, values: { firstName: firstNameOf(reply.name) } }, done: true });
  if (closed) bubbles.push({ key: "closed", from: "host", said: closed });
  return bubbles;
}
