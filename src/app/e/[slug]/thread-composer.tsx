"use client";

import { ArrowUp, Copy } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { flushSync } from "react-dom";
import { cn } from "@/lib/utils";
import { answerAfterPicking, offeredBy } from "@/questions/answers";
import type { Question } from "@/questions/question";
import { chosenStatus, RSVP_STATUSES, type RsvpStatus } from "@/rsvps/form";
import type { GuestRsvp, RsvpRefusal } from "@/rsvps/guest";
import { Confetti, useReducedMotion } from "@/themes/effects/confetti";
import { Glass } from "@/themes/glass";
import { cardButtonClasses } from "@/themes/rsvp-buttons";
import { useTheme } from "@/themes/themed-page";
import { ARRIVAL, arriving, BUBBLE_CHIP, GuestBubble, HOST_BUBBLE, HostBubble } from "@/themes/thread-bubble";
import { threadMessages, threadTurns, type Said, type ThreadEvent, type ThreadReply, type Turn } from "@/themes/thread-script";
import { Turnstile } from "@/turnstile/turnstile";
import { useCopyLink } from "./use-copy-link";
import { offersCalendar, useRsvpFlow, type Draft, type RsvpFlowProps, type RsvpFlowState } from "./use-rsvp-flow";

// About as long as the host takes to type a line.
const TYPING_MS = 650;

// The guest's RSVP in the Thread layout (spec, "Thread"): the conversation under the host's
// bubbles, and the composer at the foot of the screen the guest answers in. The flow's rules are
// use-rsvp-flow.ts's and what each state reads as is the script's (thread-script.ts); this is how
// the Thread presents them. One turn at a time: the host asks, and the composer offers the guest
// the answers (chips for a status, the plus-ones and a choice, a text composer for a name, an
// email, a phone number, a written answer or a code); the guest's answer joins the conversation,
// and the host's next line follows. Answering the last turn sends the RSVP, through hidden fields
// as the Poster's form sends it; when the host has the email proven, the host asks for the code
// sent to it, and the composer offers "Send it again". Once it is saved the host's done bubble
// carries the private link and the calendar, and the composer the three ways on.
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
  const sendFormId = useId();
  const bar = useRef<HTMLDivElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const doneLine = useRef<HTMLParagraphElement>(null);
  // Where the focus goes once the composer has what comes next: its first control, the chip for
  // the status the guest is choosing from, or the done bubble, which a screen reader then reads.
  const focusNext = useRef<"controls" | "done" | RsvpStatus | null>(null);

  const flow = useRsvpFlow(props, (target, status) => {
    focusNext.current = target === "confirmation" ? "done" : target === "code" ? "controls" : status;
  });
  const { step, draft, confirmed, working, refusal } = flow;
  // The code asked for, and the one given, stay in the conversation once the RSVP is saved. A guest
  // on the waitlist said they were in, and is told their place; one whose reply the host has not
  // approved is told that it waits for them, or that they declined it.
  const proving = { codeSentTo: flow.codeSentTo, code: draft.code };
  const reply: ThreadReply = confirmed
    ? {
        ...confirmed,
        status: chosenStatus(confirmed.status),
        waitlisted: confirmed.status === "waitlisted" ? (confirmed.waitlistPosition ?? 0) : undefined,
        approval: confirmed.approval === "approved" ? undefined : confirmed.approval,
        email: confirmed.email ?? "",
        phone: confirmed.phone ?? "",
        answers: draft.answers,
        ...proving,
      }
    : { ...draft, ...proving };
  const event: ThreadEvent = { closed: open ? undefined : (closedAs ?? "cancelled"), settings, questions };

  // The turn the guest is on within the flow's step (thread-script.ts, ThreadState). A new step
  // starts at its first turn. A refusal about one field sends the guest back to that field's
  // turn once the RSVP comes back refused, and one about none leaves them where they were.
  const [place, setPlace] = useState({ step, at: 0, working });
  let at = place.at;
  if (place.step !== step || place.working !== working) {
    at = place.step === step ? place.at : 0;
    if (place.working && !working && refusal) at = refusedAt(refusal, threadTurns(reply, event)) ?? at;
    setPlace({ step, at, working });
  }

  const bubbles = threadMessages({ step, at, reply }, event);
  const turns = threadTurns(reply, event);
  const turn = turns.find((each) => each.step === step && each.at === at);
  // With Turnstile on, the check stands over the turn whose answer sends the reply, the last (the
  // code's, once a code is sent), or, every turn answered, the Send that sends it again (spec,
  // "Turnstile"). While it runs, that turn is there as any other, its field usable, and only what
  // sends the reply waits for it, as the other layouts' submit does: Send, a chip that answers,
  // Skip, "Send it again". A check that lapses mid-answer holds them again and leaves the field be.
  const checkShown = flow.turnstile !== undefined && flow.answering && (turn === undefined || turn === turns.at(-1));
  const held = checkShown && flow.awaitingCheck;

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

  // Once what is wanted is there, the focus goes to it. While the bot check holds a turn of chips,
  // the focus waits for them on the composer.
  useEffect(() => {
    const wanted = focusNext.current;
    if (!wanted || typing || (working && flow.answering)) return;
    const control = bar.current?.querySelector<HTMLElement>('input:not([type="hidden"])') ?? bar.current?.querySelector<HTMLElement>("button:enabled");
    const target =
      wanted === "done"
        ? doneLine.current
        : wanted === "controls"
          ? (control ?? (held ? null : bar.current))
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

  // Back from the code to the email's turn, to give another.
  const changeEmail = () => {
    handOff();
    flow.changeEmail();
    setPlace({ step: "name", at: threadTurns(reply, event).find((each) => each.key === "email")?.at ?? 0, working });
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
            disabled={held}
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
          waiting={held}
        />
      );
    }
    if (asks.kind === "email") {
      return (
        <TextComposer
          label={r("name.email")}
          inputMode="email"
          autoComplete="email"
          required={asks.required}
          value={draft.email}
          onChange={(email) => flow.change({ email })}
          onSend={() => advance()}
          waiting={held}
          skip={!asks.required && <Skip className={chip()} disabled={held} onSkip={() => advance({ email: "" })} />}
        />
      );
    }
    if (asks.kind === "phone") {
      return (
        <TextComposer
          label={r("name.phone")}
          inputMode="tel"
          autoComplete="tel"
          required={asks.required}
          value={draft.phone}
          onChange={(phone) => flow.change({ phone })}
          onSend={() => advance()}
          waiting={held}
          skip={!asks.required && <Skip className={chip()} disabled={held} onSkip={() => advance({ phone: "" })} />}
        />
      );
    }
    if (asks.kind === "code") {
      return (
        <>
          <Chips>
            <button
              type="button"
              onClick={() => {
                handOff();
                flow.resend(sendForm.current);
              }}
              disabled={working || flow.resendIn > 0 || held}
              className={chip()}
            >
              {flow.resendIn > 0 ? r("code.resendIn", { seconds: flow.resendIn }) : r("code.resend")}
            </button>
            <button type="button" onClick={changeEmail} className={chip()}>
              {r("code.changeEmail")}
            </button>
          </Chips>
          <TextComposer
            label={r("code.label")}
            inputMode="numeric"
            autoComplete="one-time-code"
            value={draft.code}
            onChange={(code) => flow.change({ code })}
            onSend={() => advance()}
            waiting={held}
          />
        </>
      );
    }
    if (asks.kind === "plusOnes") {
      return (
        <Chips>
          {Array.from({ length: settings.plusOnesAllowed + 1 }, (_, count) => (
            <button
              key={count}
              type="button"
              onClick={() => advance({ plusOnes: count, plusOneNames: draft.plusOneNames.slice(0, count) })}
              disabled={held}
              className={chip()}
            >
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
          waiting={held}
        />
      );
    }
    return <QuestionComposer question={asks.question} given={draft.answers[asks.question.id] ?? []} chip={chip} flow={flow} advance={advance} held={held} />;
  })();

  // Why the RSVP was just refused, while the guest answers; why it could not be removed, with the
  // done bubble.
  const why = flow.answering ? (working ? undefined : refusal) : flow.withdrawRefusal;
  const alert = why && r(`errors.${why}`, { count: flow.refusalCount });
  // The composer is there while there is something to answer or wait for: not on an event that
  // takes no replies, to a guest who has not replied. On a full event it says, over the guest's
  // controls, that a Going reply joins the waitlist.
  const barShown = controls !== null || alert !== undefined || typing || (working && flow.answering) || checkShown;

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
            {flow.fullNotice && <p className="px-2 text-sm text-theme-text-muted">{r(flow.fullNotice)}</p>}
            {alert && (
              <p role="alert" className="px-2 text-sm font-medium">
                {alert}
              </p>
            )}
            {checkShown && flow.turnstile && <Turnstile {...flow.turnstile} form={sendFormId} />}
            {controls}
          </Glass>
        )}
        <form ref={sendForm} id={sendFormId} action={flow.send} hidden>
          <input type="hidden" name="status" value={draft.status} />
          <input type="hidden" name="name" value={draft.name} />
          <input type="hidden" name="email" value={draft.email} />
          <input type="hidden" name="phone" value={draft.phone} />
          {step === "code" && <input type="hidden" name="code" value={draft.code} />}
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
// (use-rsvp-flow.ts): the email's, the phone number's or the code's turn, or the first plus-one's
// name; anything else about a field starts its step again, so a party too big for the places left
// is asked how many again. A refusal about none (too fast, closed) leaves them where they were.
function refusedAt(refusal: RsvpRefusal, turns: Turn[]): number | undefined {
  switch (refusal) {
    case "codeWrong":
    case "codeExpired":
    case "codeResent":
    case "codeTooSoon":
    case "codeTooFast":
      return turns.find((turn) => turn.key === "code")?.at;
    case "emailRequired":
    case "emailInvalid":
      return turns.find((turn) => turn.key === "email")?.at;
    case "phoneRequired":
    case "phoneInvalid":
      return turns.find((turn) => turn.key === "phone")?.at;
    case "plusOneNameRequired":
    case "plusOneNameTooLong":
      return 1;
    case "nameRequired":
    case "nameTooLong":
    case "plusOnesInvalid":
    case "capacityFull":
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

function Skip({ className, disabled, onSkip }: { className: string; disabled?: boolean; onSkip: () => void }) {
  const t = useTranslations("EventPage");
  return (
    <button type="button" onClick={onSkip} disabled={disabled} className={className}>
      {t("thread.skip")}
    </button>
  );
}

// A line the guest writes, and Send. Enter sends it too; there is nothing to send until it holds
// something, and an optional turn is skipped instead. `waiting` holds Send back, and Enter with it,
// while the field stays as it is (the bot check, above).
function TextComposer({
  label,
  placeholder,
  inputMode,
  autoComplete = "off",
  required,
  value,
  onChange,
  onSend,
  waiting,
  skip,
}: {
  label: string;
  placeholder?: string;
  inputMode?: "email" | "tel" | "numeric";
  autoComplete?: string;
  // Whether the host requires it, which the field says to a screen reader; the line asking for
  // it offers no skip.
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  waiting?: boolean;
  skip?: ReactNode;
}) {
  const t = useTranslations("EventPage");
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (value.trim() && !waiting) onSend();
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
          aria-required={required || undefined}
          value={value}
          onChange={(typed) => onChange(typed.target.value)}
          className="size-full rounded-full border border-theme-glass-border bg-theme-glass-strong pr-12 pl-4 text-base text-theme-text placeholder:text-theme-text-faint"
        />
        <button
          type="submit"
          aria-label={t("thread.send")}
          disabled={!value.trim() || waiting}
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
  held,
}: {
  question: Question;
  given: string[];
  chip: (pressed?: boolean) => string;
  flow: RsvpFlowState;
  advance: () => void;
  // Whether what answers it waits for the bot check (ThreadComposer, above).
  held: boolean;
}) {
  const t = useTranslations("EventPage");
  const r = useTranslations("Rsvp");
  const skip = !question.required && (
    <Skip
      className={chip()}
      disabled={held}
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
        waiting={held}
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
        <button type="button" onClick={() => advance()} disabled={held || (question.required && given.length === 0)} className={chip()}>
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
          disabled={held}
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
// change it, shown and with a chip that copies it, with the calendar for a guest who is coming.
// Its words take the focus once it arrives, so a screen reader reads them.
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
  const shownLink = useRef<HTMLParagraphElement>(null);
  const link = useCopyLink(answer.editLink, shownLink);
  return (
    <HostBubble data-slot="done" className={className}>
      <p ref={lineRef} data-slot="done-text" tabIndex={-1} className="outline-none">
        {line} {t("thread.done.link")}
      </p>
      <p ref={shownLink} className={cn("mt-2 font-mono text-[13px]", link.failed ? "break-all" : "truncate")}>
        {answer.editLink}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={link.copy} className={BUBBLE_CHIP}>
          <Copy className="size-4" aria-hidden /> {link.copied ? r("editLink.copied") : t("thread.copyLink")}
        </button>
        {offersCalendar(answer) && calendar}
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
