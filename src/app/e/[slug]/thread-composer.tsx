"use client";

import { ArrowUp, Copy } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { flushSync } from "react-dom";
import { cn } from "@/lib/utils";
import { answerAfterPicking, offeredBy } from "@/questions/answers";
import type { Question } from "@/questions/question";
import { RSVP_STATUSES, type RsvpStatus } from "@/rsvps/form";
import type { GuestRsvp, RsvpRefusal } from "@/rsvps/guest";
import { Confetti, useReducedMotion } from "@/themes/effects/confetti";
import { Glass } from "@/themes/glass";
import { cardButtonClasses } from "@/themes/rsvp-buttons";
import { useTheme } from "@/themes/themed-page";
import { ARRIVAL, arriving, BUBBLE_CHIP, GuestBubble, HOST_BUBBLE, HostBubble } from "@/themes/thread-bubble";
import { threadMessages, threadTurns, type Said, type ThreadEvent, type ThreadReply } from "@/themes/thread-script";
import { useRsvpFlow, type Draft, type RsvpFlowProps, type RsvpFlowState } from "./use-rsvp-flow";

// About as long as the host takes to type a line.
const TYPING_MS = 650;

// The guest's RSVP in the Thread layout (spec, "Thread"): the conversation under the host's
// bubbles, and the composer at the foot of the screen the guest answers in. The flow's rules are
// use-rsvp-flow.ts's and what each state reads as is the script's (thread-script.ts); this is how
// the Thread presents them. One turn at a time: the host asks, and the composer offers the guest
// the answers (chips for a status, the plus-ones and a choice, a text composer for a name, an
// email or a written answer); the guest's answer joins the conversation, and the host's next line
// follows. Answering the last turn sends the RSVP, through hidden fields as the Poster's form
// sends it; once it is saved the host's done bubble carries the private link and the calendar,
// and the composer the three ways on.
//
// What the page holds when it opens arrives at once. A host line that answers the guest comes
// after the host has been seen typing for a moment, and the page follows the conversation down.
// Under reduced motion every line is simply there, and the page jumps rather than scrolls.
export function ThreadComposer({ closedAs, ...props }: RsvpFlowProps & { closedAs?: "cancelled" | "draft" }) {
  const { settings, open, questions, calendar } = props;
  const t = useTranslations("EventPage");
  const r = useTranslations("Rsvp");
  const format = useFormatter();
  const { buttonStyle } = useTheme().resolved;
  const reduce = useReducedMotion();
  const sendForm = useRef<HTMLFormElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const doneLine = useRef<HTMLParagraphElement>(null);
  // Where the focus goes once the composer has what comes next: its first control, the chip for
  // the status the guest is choosing from, or the done bubble, which a screen reader then reads.
  const focusNext = useRef<"controls" | "done" | RsvpStatus | null>(null);

  const flow = useRsvpFlow(props, (target, status) => {
    focusNext.current = target === "confirmation" ? "done" : status;
  });
  const { step, draft, confirmed, working, refusal } = flow;

  // The turn the guest is on within the flow's step (thread-script.ts, ThreadState). A new step
  // starts at its first turn. A refusal about one field sends the guest back to that field's
  // turn once the RSVP comes back refused, and one about none leaves them where they were.
  const [place, setPlace] = useState({ step, at: 0, working });
  let at = place.at;
  if (place.step !== step || place.working !== working) {
    at = place.step === step ? place.at : 0;
    if (place.working && !working && refusal) at = refusedAt(refusal) ?? at;
    setPlace({ step, at, working });
  }

  const reply: ThreadReply = confirmed ? { ...confirmed, email: confirmed.email ?? "", answers: draft.answers } : draft;
  const event: ThreadEvent = { closed: open ? undefined : (closedAs ?? "cancelled"), settings, questions };
  const bubbles = threadMessages({ step, at, reply }, event);
  const turn = threadTurns(reply, event).find((each) => each.step === step && each.at === at);

  // How much of the conversation shows. What is there when the page opens shows at once; after
  // that, whatever the guest says shows as they say it, and each host line once the host has been
  // seen typing it. What both conversations share stays as it was.
  const keys = bubbles.map((bubble) => bubble.key).join("\n");
  const voices = bubbles.map((bubble) => bubble.from).join(" ");
  const [pace, setPace] = useState({ keys, shown: bubbles.length, opening: true });
  let shown = pace.shown;
  if (pace.keys !== keys) {
    const before = pace.keys.split("\n");
    let kept = 0;
    while (kept < before.length && kept < bubbles.length && before[kept] === bubbles[kept].key) kept++;
    shown = reduce ? bubbles.length : saidAtOnce(voices, Math.min(pace.shown, kept));
    setPace({ keys, shown, opening: false });
  }
  const typing = shown < bubbles.length;

  useEffect(() => {
    if (!typing) return;
    const timer = setTimeout(() => setPace((current) => ({ ...current, shown: saidAtOnce(voices, current.shown + 1) })), TYPING_MS);
    return () => clearTimeout(timer);
  }, [typing, shown, voices]);

  // The page follows the conversation as it grows, so its newest line sits above the composer;
  // never as the page opens, which starts at the invitation.
  const before = useRef({ shown, typing });
  useEffect(() => {
    const grew = shown > before.current.shown || (typing && !before.current.typing);
    before.current = { shown, typing };
    const bottom = end.current?.getBoundingClientRect().bottom;
    if (!grew || bottom === undefined) return;
    const top = window.scrollY + bottom + (bar.current?.offsetHeight ?? 0) + 16 - window.innerHeight;
    if (top > window.scrollY) window.scrollTo({ top, behavior: reduce ? "instant" : "smooth" });
  }, [shown, typing, reduce]);

  // Once what is wanted is there, the focus goes to it.
  useEffect(() => {
    const wanted = focusNext.current;
    if (!wanted || typing || (working && flow.answering)) return;
    const target =
      wanted === "done"
        ? doneLine.current
        : wanted === "controls"
          ? (bar.current?.querySelector<HTMLElement>('input:not([type="hidden"])') ?? bar.current?.querySelector<HTMLElement>("button:enabled") ?? bar.current)
          : (bar.current?.querySelector<HTMLElement>(`[data-status="${wanted}"]`) ?? bar.current);
    if (!target) return;
    focusNext.current = null;
    target.focus({ preventScroll: true });
  });

  // The guest has answered from the composer, which is about to change under them: the focus
  // waits on the composer itself, and moves to what it offers next.
  const handOff = () => {
    focusNext.current = "controls";
    bar.current?.focus({ preventScroll: true });
  };

  // On to the next turn: within the step, to the flow's next step, or, after the last, the RSVP
  // is sent. A patch to the draft goes with it, and decides how many turns the step has (a
  // plus-one's name is asked for each plus-one).
  const advance = (patch: Partial<Draft> = {}) => {
    handOff();
    const next = at + 1;
    const turns = threadTurns({ ...reply, ...patch }, event).filter((each) => each.step === step).length;
    const apply = () => {
      if (Object.keys(patch).length > 0) flow.change(patch);
    };
    if (next < turns) {
      apply();
      setPlace({ step, at: next, working });
    } else if (!flow.last) {
      apply();
      flow.forward();
    } else {
      // The hidden fields must hold this answer before the form is sent.
      flushSync(() => {
        apply();
        setPlace({ step, at: next, working });
      });
      sendForm.current?.requestSubmit();
    }
  };

  const say = (said: Said): ReactNode => {
    if ("text" in said) return said.text;
    if ("list" in said) return format.list(said.list, { type: "conjunction" });
    if ("rsvp" in said) return r(said.rsvp);
    return t(`thread.${said.line}`, said.values);
  };

  const chip = (pressed = false) =>
    cn(
      cardButtonClasses(buttonStyle),
      "h-11 shrink-0 rounded-full px-4 text-[15px]",
      pressed && "border-transparent bg-theme-accent text-theme-on-accent ring-2 ring-theme-text hover:bg-theme-accent",
    );

  const controls = ((): ReactNode => {
    if (typing || (working && flow.answering)) return null;
    if (step === "idle") {
      if (!open) return null;
      return (
        <Chips>
          {RSVP_STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              data-status={status}
              onClick={() => {
                handOff();
                flow.pick(status);
              }}
              className={chip()}
            >
              {r(status)}
            </button>
          ))}
        </Chips>
      );
    }
    if (step === "done") {
      return (
        <Chips>
          <button type="button" onClick={flow.changeAnswer} className={chip()}>
            {r("change")}
          </button>
          <button
            type="button"
            onClick={() => {
              handOff();
              flow.editDetails();
            }}
            className={chip()}
          >
            {t("thread.edit")}
          </button>
          <button type="button" onClick={flow.withdraw} disabled={working} className={chip()}>
            {r("remove")}
          </button>
        </Chips>
      );
    }
    // Every turn answered, and the RSVP refused for no field in particular (too fast): sent again.
    if (!turn) {
      if (!refusal) return null;
      return (
        <Chips>
          <button
            type="button"
            onClick={() => {
              handOff();
              sendForm.current?.requestSubmit();
            }}
            className={chip()}
          >
            {r("send")}
          </button>
        </Chips>
      );
    }

    const { asks } = turn;
    if (asks.kind === "name") {
      return (
        <TextComposer
          label={r("name.label")}
          placeholder={r("name.placeholder")}
          autoComplete="name"
          value={draft.name}
          onChange={(name) => flow.change({ name })}
          onSend={() => advance()}
        />
      );
    }
    if (asks.kind === "email") {
      return (
        <TextComposer
          label={r("name.email")}
          inputMode="email"
          autoComplete="email"
          value={draft.email}
          onChange={(email) => flow.change({ email })}
          onSend={() => advance()}
          skip={<Skip className={chip()} onSkip={() => advance({ email: "" })} />}
        />
      );
    }
    if (asks.kind === "plusOnes") {
      return (
        <Chips>
          {Array.from({ length: settings.plusOnesAllowed + 1 }, (_, count) => (
            <button key={count} type="button" onClick={() => advance({ plusOnes: count, plusOneNames: draft.plusOneNames.slice(0, count) })} className={chip()}>
              {count === 0 ? r("plusOnes.justMe") : `+${count}`}
            </button>
          ))}
        </Chips>
      );
    }
    if (asks.kind === "guestName") {
      const index = asks.number - 1;
      return (
        <TextComposer
          label={r("plusOnes.guestName", { number: asks.number })}
          value={draft.plusOneNames[index] ?? ""}
          onChange={(name) => {
            const names = Array.from({ length: draft.plusOnes }, (_, each) => draft.plusOneNames[each] ?? "");
            names[index] = name;
            flow.change({ plusOneNames: names });
          }}
          onSend={() => advance()}
        />
      );
    }
    return <QuestionComposer question={asks.question} given={draft.answers[asks.question.id] ?? []} chip={chip} flow={flow} advance={advance} />;
  })();

  // Why the RSVP was just refused, while the guest answers; why it could not be removed, with the
  // done bubble.
  const why = flow.answering ? (working ? undefined : refusal) : flow.withdrawRefusal;
  const alert = why && r(`errors.${why}`);
  // The composer is there while there is something to answer or wait for: not on an event that
  // takes no replies, to a guest who has not replied.
  const barShown = controls !== null || alert !== undefined || typing || (working && flow.answering);

  return (
    <>
      {/* Apart from the conversation, so going on from the done bubble neither stops it nor starts it again. */}
      {flow.falls > 0 && <Confetti key={flow.falls} />}
      <div role="log" className="mt-2 flex flex-1 flex-col gap-2 pb-4">
        {bubbles.slice(0, shown).map((bubble) => {
          const arrival = pace.opening ? arriving() : ARRIVAL;
          if (bubble.from === "guest") {
            return (
              <GuestBubble key={bubble.key} className={arrival}>
                {say(bubble.said)}
              </GuestBubble>
            );
          }
          if (bubble.done && confirmed) {
            return <DoneBubble key={bubble.key} className={arrival} line={say(bubble.said)} answer={confirmed} calendar={calendar} lineRef={doneLine} />;
          }
          return (
            <HostBubble key={bubble.key} className={arrival}>
              {say(bubble.said)}
            </HostBubble>
          );
        })}
        {typing && <Typing />}
        <div ref={end} />
      </div>

      <div ref={bar} tabIndex={-1} className="sticky bottom-0 z-20 pt-2 pb-[max(env(safe-area-inset-bottom),0.75rem)] outline-none">
        {barShown && (
          <Glass className="flex min-h-16 flex-col justify-center gap-2 rounded-[28px] p-2.5">
            {alert && (
              <p role="alert" className="px-2 text-sm font-medium">
                {alert}
              </p>
            )}
            {controls}
          </Glass>
        )}
        <form ref={sendForm} action={flow.send} hidden>
          <input type="hidden" name="status" value={draft.status} />
          <input type="hidden" name="name" value={draft.name} />
          <input type="hidden" name="email" value={draft.email} />
          <input type="hidden" name="plusOnes" value={draft.plusOnes} />
          {Array.from({ length: draft.plusOnes }, (_, index) => (
            <input key={index} type="hidden" name="plusOneNames" value={draft.plusOneNames[index] ?? ""} />
          ))}
          {questions.flatMap((question) =>
            (draft.answers[question.id] ?? []).map((value, index) => <input key={`${question.id}:${index}`} type="hidden" name={`answer:${question.id}`} value={value} />),
          )}
        </form>
      </div>
    </>
  );
}

// Where a refusal about one field sends the guest back to, within the step the flow sends them to
// (use-rsvp-flow.ts): the email's turn, or the first plus-one's name; anything else about a field
// starts its step again. A refusal about none (too fast, closed) leaves them where they were.
function refusedAt(refusal: RsvpRefusal): number | undefined {
  switch (refusal) {
    case "emailInvalid":
    case "plusOneNameRequired":
    case "plusOneNameTooLong":
      return 1;
    case "nameRequired":
    case "nameTooLong":
    case "plusOnesInvalid":
    case "answerRequired":
    case "answerNotOffered":
    case "answerTooLong":
      return 0;
    default:
      return undefined;
  }
}

// How much of the conversation shows from `shown` on without the host typing: the guest's own
// bubbles show as soon as they are said.
function saidAtOnce(voices: string, shown: number): number {
  const from = voices.split(" ");
  let at = shown;
  while (at < from.length && from[at] === "guest") at++;
  return at;
}

function Chips({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div role={label ? "group" : undefined} aria-label={label} className="flex flex-wrap justify-end gap-2">
      {children}
    </div>
  );
}

function Skip({ className, onSkip }: { className: string; onSkip: () => void }) {
  const t = useTranslations("EventPage");
  return (
    <button type="button" onClick={onSkip} className={className}>
      {t("thread.skip")}
    </button>
  );
}

// A line the guest writes, and Send. Enter sends it too; there is nothing to send until it holds
// something, and an optional turn is skipped instead.
function TextComposer({
  label,
  placeholder,
  inputMode,
  autoComplete = "off",
  value,
  onChange,
  onSend,
  skip,
}: {
  label: string;
  placeholder?: string;
  inputMode?: "email";
  autoComplete?: string;
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  skip?: ReactNode;
}) {
  const t = useTranslations("EventPage");
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (value.trim()) onSend();
      }}
      className="flex items-center gap-2"
    >
      {skip}
      {/* The field is the whole pill, so the keyboard's focus rings the pill; Send sits at its end. */}
      <div className="relative h-12 min-w-0 flex-1">
        <input
          aria-label={label}
          placeholder={placeholder}
          inputMode={inputMode}
          autoComplete={autoComplete}
          value={value}
          onChange={(typed) => onChange(typed.target.value)}
          className="size-full rounded-full border border-theme-glass-border bg-theme-glass-strong pr-12 pl-4 text-base text-theme-text placeholder:text-theme-text-faint"
        />
        <button
          type="submit"
          aria-label={t("thread.send")}
          disabled={!value.trim()}
          className="absolute top-1.5 right-1.5 grid size-9 cursor-pointer place-items-center rounded-full bg-theme-accent text-theme-on-accent disabled:cursor-default disabled:opacity-40"
        >
          <ArrowUp className="size-5" aria-hidden />
        </button>
      </div>
    </form>
  );
}

// One of the host's questions: a written answer in the composer, with Skip when it is optional;
// a single choice or yes or no as chips, the guest's pick being their answer; several choices as
// chips that toggle, then Done, which waits for a pick when the question needs one. Picking
// follows the one rule every layout does (use-rsvp-flow.ts, pickOption), so picking the chosen
// answer of an optional question again takes it back, and the guest stays on the question.
function QuestionComposer({
  question,
  given,
  chip,
  flow,
  advance,
}: {
  question: Question;
  given: string[];
  chip: (pressed?: boolean) => string;
  flow: RsvpFlowState;
  advance: () => void;
}) {
  const t = useTranslations("EventPage");
  const r = useTranslations("Rsvp");
  const skip = !question.required && (
    <Skip
      className={chip()}
      onSkip={() => {
        flow.recordAnswer(question.id, []);
        advance();
      }}
    />
  );

  if (question.type === "text") {
    return (
      <TextComposer
        label={question.prompt}
        value={given[0] ?? ""}
        onChange={(typed) => flow.recordAnswer(question.id, [typed])}
        onSend={advance}
        skip={skip}
      />
    );
  }

  const options = offeredBy(question) ?? [];
  const label = (option: string) => (question.type === "yesNo" ? r(`questions.${option as "yes" | "no"}`) : option);
  if (question.type === "multiple") {
    return (
      <Chips label={question.prompt}>
        {options.map((option) => (
          <button key={option} type="button" aria-pressed={given.includes(option)} onClick={() => flow.pickOption(question, option)} className={chip(given.includes(option))}>
            {label(option)}
          </button>
        ))}
        <button type="button" onClick={advance} disabled={question.required && given.length === 0} className={chip()}>
          {t("thread.finish")}
        </button>
      </Chips>
    );
  }
  return (
    <Chips label={question.prompt}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={given.includes(option)}
          onClick={() => {
            const after = answerAfterPicking(question, given, option);
            flow.pickOption(question, option);
            if (after.length > 0) advance();
          }}
          className={chip(given.includes(option))}
        >
          {label(option)}
        </button>
      ))}
      {skip}
    </Chips>
  );
}

// The host's last line: how the guest stands, by their first name, and their private link to
// change it, which they can copy, with the calendar for a guest who is coming. Its words take
// the focus once it arrives, so a screen reader reads them.
function DoneBubble({
  className,
  line,
  answer,
  calendar,
  lineRef,
}: {
  className: string;
  line: ReactNode;
  answer: GuestRsvp;
  calendar?: ReactNode;
  lineRef: RefObject<HTMLParagraphElement | null>;
}) {
  const t = useTranslations("EventPage");
  const r = useTranslations("Rsvp");
  const [copied, setCopied] = useState(false);
  return (
    <HostBubble data-slot="done" className={className}>
      <p ref={lineRef} tabIndex={-1} className="outline-none">
        {line} {t("thread.done.link")}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => navigator.clipboard.writeText(answer.editLink).then(() => setCopied(true))} className={BUBBLE_CHIP}>
          <Copy className="size-4" aria-hidden /> {copied ? r("editLink.copied") : t("thread.copyLink")}
        </button>
        {answer.status !== "cant" && calendar}
      </div>
    </HostBubble>
  );
}

// The host typing: three dots that rise in turn. Only ever shown when motion is welcome.
function Typing() {
  return (
    <div aria-hidden data-slot="typing" className={cn(HOST_BUBBLE, "flex h-10 items-center gap-1 py-0", ARRIVAL)}>
      {[0, 150, 300].map((delay) => (
        <span key={delay} className="size-2 rounded-full bg-current opacity-60 motion-safe:animate-theme-typing" style={{ animationDelay: `${delay}ms` }} />
      ))}
    </div>
  );
}
