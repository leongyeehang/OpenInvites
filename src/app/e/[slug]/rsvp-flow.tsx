"use client";

import { Check, ChevronLeft, Copy, X } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Dialog } from "radix-ui";
import { useCallback, useEffect, useRef, useState, useTransition, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { removeRsvpAction, saveRsvpAction } from "@/rsvps/actions";
import { offeredBy } from "@/questions/answers";
import type { Question } from "@/questions/question";
import { RSVP_STATUSES, type RsvpSettings, type RsvpStatus } from "@/rsvps/form";
import type { GuestRsvp, RsvpRefusal } from "@/rsvps/guest";
import { Glass } from "@/themes/glass";
import { sheetVariables } from "@/themes/resolve";
import { rsvpButtonClasses } from "@/themes/rsvp-buttons";
import { useTheme } from "@/themes/themed-page";

// Where the guest is in the flow (PROTOTYPE.md): the three buttons, then their name, then who
// they are bringing, then the confirmation. Ticket 09 puts the host's questions before the end.
type Step = "idle" | "name" | "plusones" | "questions" | "done";

// Which step holds the field a refusal is about, so a guest is never shown "fix your email"
// with the email field hidden two steps back. A refusal about no field in particular leaves the
// guest where they are, with the message in front of them.
const STEP_OF: Partial<Record<RsvpRefusal, Step>> = {
  nameRequired: "name",
  nameTooLong: "name",
  emailInvalid: "name",
  plusOnesInvalid: "plusones",
  plusOneNameRequired: "plusones",
  plusOneNameTooLong: "plusones",
  answerRequired: "questions",
  answerNotOffered: "questions",
  answerTooLong: "questions",
};

type Draft = {
  status: RsvpStatus;
  name: string;
  plusOnes: number;
  plusOneNames: string[];
  email: string;
  answers: Record<string, string>;
};

const BLANK: Draft = { status: "going", name: "", plusOnes: 0, plusOneNames: [], email: "", answers: {} };

// Coming back to change an answer starts from the answer that is already there, except that a
// host who has since lowered the plus-ones allowance wins: otherwise the guest would carry an
// impossible number into every attempt to save, and never be able to change their RSVP again.
function draftFrom(mine: GuestRsvp | undefined, settings: RsvpSettings, answers: Record<string, string>): Draft {
  if (!mine) return { ...BLANK, answers };
  const { status, name, plusOneNames, email } = mine;
  const plusOnes = Math.min(mine.plusOnes, settings.plusOnesAllowed);
  return { status, name, plusOnes, plusOneNames: plusOneNames.slice(0, plusOnes), email: email ?? "", answers };
}

type Props = {
  slug: string;
  settings: RsvpSettings;
  mine: GuestRsvp | undefined;
  open: boolean;
  questions: Question[];
  answers: Record<string, string>;
  calendar?: ReactNode;
};

// The guest's whole RSVP: the three buttons under the poster, the steps, and once they have
// answered, their confirmation. It is one flow whichever RSVP style the theme sets; only what the
// steps and the confirmation appear in differs. Inline, they open under the buttons, and the
// confirmation takes the buttons' place. In the Sheet style they rise over the invitation in a
// sheet (PROTOTYPE.md), the buttons stay, and a guest who has answered can close the sheet and
// open it again. Everything wears the page's theme, which the host may be changing as the guest
// would see it.
export function RsvpFlow({ slug, settings, mine, open, questions, answers, calendar }: Props) {
  const t = useTranslations("Rsvp");
  const { buttonStyle, rsvpStyle } = useTheme().resolved;
  const [step, setStep] = useState<Step>(mine ? "done" : "idle");
  const [answer, setAnswer] = useState(mine);
  const [draft, setDraft] = useState<Draft>(() => draftFrom(mine, settings, answers));
  const [error, setError] = useState<RsvpRefusal>();
  // Why the guest's RSVP could not be removed just now, shown with their confirmation.
  const [withdrawRefusal, setWithdrawRefusal] = useState<"tooFast">();
  const [working, startWorking] = useTransition();
  const form = useRef<HTMLFormElement>(null);
  // The sheet opens when the guest chooses a status or asks to see their RSVP, and hands focus
  // back to whichever button that was when it closes.
  const sheet = rsvpStyle === "sheet";
  const [sheetOpen, setSheetOpen] = useState(false);
  const opener = useRef<HTMLButtonElement | null>(null);
  const statusButtons = useRef<Partial<Record<RsvpStatus, HTMLButtonElement | null>>>({});
  const followFocus = useRef(false);

  // Declining takes two taps, so a guest who can't go is asked nothing else. Everyone else is
  // asked only what this event has to ask.
  const steps: Step[] =
    draft.status === "cant"
      ? ["name"]
      : ["name", ...(settings.plusOnesAllowed > 0 ? (["plusones"] as const) : []), ...(questions.length > 0 ? (["questions"] as const) : [])];
  const position = Math.max(0, steps.indexOf(step));
  const last = position === steps.length - 1;
  const confirmed = answer !== undefined && step === "done";
  const answering = step !== "idle" && !confirmed;

  const change = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));
  const recordAnswer = (questionId: string, value: string) =>
    setDraft((current) => ({ ...current, answers: { ...current.answers, [questionId]: value } }));

  const headings: Partial<Record<Step, string>> = {
    name: t(draft.status === "cant" ? "name.cantTitle" : "name.title"),
    plusones: t("plusOnes.title"),
    questions: t("questions.title"),
  };
  const forward = () => setStep(steps[position + 1]);
  const back = () => setStep(position === 0 ? "idle" : steps[position - 1]);

  const openSheet = (from: HTMLButtonElement) => {
    opener.current = from;
    setSheetOpen(true);
  };
  // Closing the sheet part-way leaves the RSVP as it was: the saved one, if there is one.
  const closeSheet = () => {
    setSheetOpen(false);
    if (step !== "done") setStep(answer ? "done" : "idle");
  };
  // Once the sheet has gone, however it went (the guest may have changed or removed their answer
  // from inside it), it stays shut, and focus goes back to what opened it or, when that has gone
  // too, to the button for the status they are choosing from.
  const sheetClosed = () => {
    setSheetOpen(false);
    (opener.current?.isConnected ? opener.current : statusButtons.current[draft.status])?.focus();
  };

  const pick = (status: RsvpStatus, from: HTMLButtonElement) => {
    change({ status, plusOnes: status === "cant" ? 0 : draft.plusOnes });
    setStep("name");
    if (sheet) openSheet(from);
  };

  // Enter moves on from inside a step, which hides the field it was pressed in. Focus follows to
  // the new step, so the keyboard is never left on something hidden (and never let out of the
  // sheet that way).
  useEffect(() => {
    if (!followFocus.current) return;
    followFocus.current = false;
    form.current?.querySelector<HTMLElement>(`[data-step="${step}"] :is(input:not([type="hidden"]), textarea, button)`)?.focus({ preventScroll: true });
  }, [step]);

  const send = (formData: FormData) =>
    startWorking(async () => {
      const result = await saveRsvpAction(slug, formData);
      setError(result.error);
      if (result.error) {
        const owner = STEP_OF[result.error];
        if (owner && steps.includes(owner)) setStep(owner);
        return;
      }
      if (!result.saved) return;
      setAnswer(result.saved);
      setStep("done");
    });

  const remove = () =>
    startWorking(async () => {
      const result = await removeRsvpAction(slug);
      setWithdrawRefusal(result.error);
      if (result.error) return;
      setAnswer(undefined);
      setDraft(BLANK);
      setStep("idle");
    });

  const confirmation = confirmed && (
    <Confirmation
      answer={answer}
      onChangeAnswer={() => {
        setWithdrawRefusal(undefined);
        setStep("idle");
      }}
      onEditDetails={() => {
        setWithdrawRefusal(undefined);
        setStep("name");
      }}
      onRemove={remove}
      removing={working}
      refusal={withdrawRefusal && t(`errors.${withdrawRefusal}`)}
      calendar={calendar}
      dismiss={
        sheet && (
          <Dialog.Close
            aria-label={t("sheet.close")}
            className="-mt-1 -mr-2 grid size-9 shrink-0 cursor-pointer place-items-center rounded-full hover:bg-theme-glass"
          >
            <X className="size-5" aria-hidden />
          </Dialog.Close>
        )
      }
    />
  );

  const stepper = answering && (
    <form
      ref={form}
      action={send}
      // Enter in a field finishes its step rather than sending a half-filled RSVP. On a button it
      // does what the button says, so Back goes back and a plus-one chip is chosen.
      onKeyDown={(event) => {
        if (event.key !== "Enter" || last || !(event.target instanceof HTMLInputElement)) return;
        event.preventDefault();
        if (!draft.name.trim()) return;
        followFocus.current = true;
        forward();
      }}
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="status" value={draft.status} />
      <input type="hidden" name="plusOnes" value={draft.plusOnes} />

      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={back}
          aria-label={t("back")}
          className="-ml-1 grid size-9 shrink-0 cursor-pointer place-items-center rounded-full hover:bg-theme-glass"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <div className="flex-1">
          <div className="mb-1.5 flex gap-1" aria-label={t("step", { step: position + 1, total: steps.length })}>
            {steps.map((each, index) => (
              <span
                key={each}
                className={cn("h-1 flex-1 rounded-full", index <= position ? "bg-theme-accent" : "bg-theme-glass-strong")}
              />
            ))}
          </div>
          <p className="font-title text-2xl leading-tight">{headings[step] ?? t("name.title")}</p>
        </div>
      </div>

      <div data-step="name" hidden={step !== "name"} className="flex flex-col gap-4">
        <Labelled label={t("name.label")}>
          <input
            ref={focusOnArrival}
            name="name"
            value={draft.name}
            onChange={(typed) => change({ name: typed.target.value })}
            placeholder={t("name.placeholder")}
            className={FIELD}
          />
        </Labelled>
        {settings.askEmail && (
          <Labelled label={t("name.email")} hint={t("name.emailHint")}>
            <input
              // Not type="email": on a later step this field is hidden, and a browser
              // cannot show a validation bubble on something it cannot focus, so it would
              // block the send in silence. The action checks the address instead.
              inputMode="email"
              autoComplete="email"
              name="email"
              value={draft.email}
              onChange={(typed) => change({ email: typed.target.value })}
              className={FIELD}
            />
          </Labelled>
        )}
      </div>

      <div data-step="plusones" hidden={step !== "plusones"} className="flex flex-col gap-3">
        <p className="text-sm text-theme-text-muted">{t("plusOnes.hint", { count: settings.plusOnesAllowed })}</p>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t("plusOnes.title")}>
          {Array.from({ length: settings.plusOnesAllowed + 1 }, (_, count) => (
            <button
              key={count}
              type="button"
              role="radio"
              aria-checked={draft.plusOnes === count}
              onClick={() => change({ plusOnes: count })}
              className={cn(
                "h-12 cursor-pointer rounded-xl text-base font-medium transition-colors motion-reduce:transition-none",
                draft.plusOnes === count ? "bg-theme-accent text-theme-on-accent" : "bg-theme-glass-strong hover:bg-theme-glass",
              )}
            >
              {count === 0 ? t("plusOnes.justMe") : `+${count}`}
            </button>
          ))}
        </div>
        {Array.from({ length: draft.plusOnes }, (_, index) => (
          <Labelled key={index} label={t("plusOnes.guestName", { number: index + 1 })}>
            <input
              name="plusOneNames"
              value={draft.plusOneNames[index] ?? ""}
              onChange={(typed) => {
                const names = [...draft.plusOneNames];
                names[index] = typed.target.value;
                change({ plusOneNames: names });
              }}
              placeholder={settings.requirePlusOneNames ? undefined : t("plusOnes.optional")}
              className={FIELD}
            />
          </Labelled>
        ))}
      </div>

      <div data-step="questions" hidden={step !== "questions"}>
        <ol data-slot="questions" className="flex flex-col gap-4">
          {questions.map((question) => (
            <li key={question.id}>
              {question.type === "text" ? (
                <label className="block">
                  <span className="mb-1.5 block text-sm text-theme-text-muted">
                    <Asked question={question} optional={t("questions.optional")} />
                  </span>
                  <textarea
                    name={`answer:${question.id}`}
                    rows={2}
                    value={draft.answers[question.id] ?? ""}
                    onChange={(typed) => recordAnswer(question.id, typed.target.value)}
                    className={cn(FIELD, "h-auto py-3")}
                  />
                </label>
              ) : (
                <fieldset>
                  <legend className="mb-1.5 text-sm text-theme-text-muted">
                    <Asked question={question} optional={t("questions.optional")} />
                  </legend>
                  <input type="hidden" name={`answer:${question.id}`} value={draft.answers[question.id] ?? ""} />
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={question.prompt}>
                    {(offeredBy(question) ?? []).map((option) => {
                      const chosen = draft.answers[question.id] === option;
                      return (
                        <button
                          key={option}
                          type="button"
                          role="radio"
                          aria-checked={chosen}
                          // Tapping the chosen answer again takes it back, which is the
                          // only way to leave an optional question unanswered.
                          onClick={() => recordAnswer(question.id, chosen && !question.required ? "" : option)}
                          className={cn(
                            "h-10 cursor-pointer rounded-full px-4 text-sm font-medium transition-colors motion-reduce:transition-none",
                            chosen ? "bg-theme-accent text-theme-on-accent" : "bg-theme-glass-strong hover:bg-theme-glass",
                          )}
                        >
                          {question.type === "yesNo" ? t(`questions.${option as "yes" | "no"}`) : option}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              )}
            </li>
          ))}
        </ol>
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium">
          {t(`errors.${error}`)}
        </p>
      )}

      <button
        // Never type="submit": React would turn this very element into one as the step
        // changes, mid-click, and the browser would then send the half-filled form.
        type="button"
        onClick={() => (last ? form.current?.requestSubmit() : forward())}
        disabled={working || !draft.name.trim()}
        className="h-12 cursor-pointer rounded-2xl bg-theme-accent text-base font-medium text-theme-on-accent transition-opacity hover:opacity-90 disabled:cursor-default motion-reduce:transition-none disabled:opacity-50"
      >
        {last ? t("send") : t("continue")}
      </button>
    </form>
  );

  // What the buttons show as chosen: the saved answer once there is one, else the one being given.
  const chosen = confirmed ? answer.status : answering ? draft.status : undefined;
  const buttons = (
    <>
      <div className="grid grid-cols-3 gap-2">
        {RSVP_STATUSES.map((status) => (
          <button
            key={status}
            ref={(button) => {
              statusButtons.current[status] = button;
            }}
            type="button"
            disabled={!open}
            onClick={(event) => pick(status, event.currentTarget)}
            className={rsvpButtonClasses(buttonStyle, { selected: chosen === status })}
          >
            {t(status)}
          </button>
        ))}
      </div>
      {/* Set on the page itself, so on the veil that keeps bare text readable. */}
      {!open && <p className="mx-auto mt-2 w-fit rounded-full bg-theme-veil px-3 py-1 text-center text-xs text-theme-text-faint backdrop-blur-xl">{t("errors.closed")}</p>}
    </>
  );

  if (!sheet) {
    if (confirmation) return <Glass className="p-5">{confirmation}</Glass>;
    return (
      <div>
        {buttons}
        {stepper && <Glass className="mt-3 p-5">{stepper}</Glass>}
      </div>
    );
  }

  return (
    <div>
      {buttons}
      {/* On the veil too. It stays while the sheet is open, so focus can come back to it. */}
      {confirmed && (
        <p className="mx-auto mt-2 w-fit rounded-full bg-theme-veil px-3 py-1.5 text-center text-xs text-theme-text-muted backdrop-blur-xl">
          {t("replied", { name: answer.name })}{" "}
          <button type="button" onClick={(event) => openSheet(event.currentTarget)} className="cursor-pointer font-medium text-theme-text underline underline-offset-2">
            {t("showMine")}
          </button>
        </p>
      )}
      <RsvpSheet open={sheetOpen && (answering || confirmed)} onClose={closeSheet} onClosed={sheetClosed}>
        {confirmation || stepper}
      </RsvpSheet>
    </div>
  );
}

// The Sheet style's container: a frosted sheet that rises from the foot of the screen over the
// invitation, which stays in view above it, and grows and shrinks with its step. It is modal to
// the flow: focus stays inside it until it closes, and Escape closes it. A tap on the page behind
// does nothing, so a guest who taps away the keyboard mid-answer keeps their place. It is put
// inside the page's own element, so it wears the theme, and sets its own tint and the text
// strengths that read on it (legibility.ts, SHEET_SURFACES). Under reduced motion it neither
// slides nor resizes smoothly: it is simply there, at its new size.
function RsvpSheet({ open, onClose, onClosed, children }: { open: boolean; onClose: () => void; onClosed: () => void; children: ReactNode }) {
  const t = useTranslations("Rsvp");
  const { resolved, root } = useTheme();
  // The sheet takes its content's height, so a change of step can move between the two heights.
  const [height, setHeight] = useState<number>();
  const measure = useCallback((content: HTMLDivElement | null) => {
    if (!content) return;
    const observer = new ResizeObserver(() => setHeight(content.offsetHeight));
    observer.observe(content);
    return () => {
      observer.disconnect();
      setHeight(undefined);
    };
  }, []);

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal container={root}>
        <Dialog.Content
          data-slot="rsvp-sheet"
          onPointerDownOutside={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            onClosed();
          }}
          style={{ ...(sheetVariables(resolved) as CSSProperties), height }}
          // Beside the host's side panel, it centres in the room left for the page.
          className="fixed inset-x-3 bottom-[max(env(safe-area-inset-bottom),0.75rem)] z-60 mx-auto box-content flex max-w-[34rem] flex-col justify-end overflow-hidden rounded-[28px] border border-theme-glass-border bg-theme-sheet text-theme-text shadow-sheet backdrop-blur-2xl outline-none transition-[height] duration-300 ease-out designing:md:right-101 motion-reduce:transition-none motion-safe:data-[state=closed]:animate-out motion-safe:data-[state=closed]:fade-out motion-safe:data-[state=closed]:slide-out-to-bottom-8 motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in motion-safe:data-[state=open]:slide-in-from-bottom-8"
        >
          {/* Held to the sheet's foot, so as the sheet grows or shrinks only its top edge moves:
              each control is drawn where it stays, and a tap as soon as it shows lands on it. */}
          <div ref={measure} className="max-h-[80dvh] shrink-0 overflow-y-auto overscroll-contain p-5">
            <Dialog.Title className="sr-only">{t("sheet.title")}</Dialog.Title>
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// The name field takes focus as the steps appear, as autoFocus would, but without scrolling the
// page: under the sheet, which is fixed to the screen, that would only move the invitation away.
function focusOnArrival(field: HTMLInputElement | null) {
  field?.focus({ preventScroll: true });
}

// The prompt, and whether the host insists on an answer.
function Asked({ question, optional }: { question: Question; optional: string }) {
  return (
    <>
      {question.prompt}
      {question.required ? (
        <span className="text-theme-accent-ink"> *</span>
      ) : (
        <span className="text-theme-text-faint"> · {optional}</span>
      )}
    </>
  );
}

const FIELD =
  "h-12 w-full rounded-xl border border-theme-glass-border bg-theme-glass-strong px-4 text-base text-theme-text placeholder:text-theme-text-faint outline-none focus:ring-2 focus:ring-theme-accent";

function Labelled({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium tracking-wider text-theme-text-faint uppercase">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-theme-text-faint">{hint}</span>}
    </label>
  );
}

// What the guest sees once they have answered: their reply, the private link that changes it
// from any device, and the three ways out.
function Confirmation({
  answer,
  onChangeAnswer,
  onEditDetails,
  onRemove,
  removing,
  refusal,
  calendar,
  dismiss,
}: {
  answer: GuestRsvp;
  onChangeAnswer: () => void;
  onEditDetails: () => void;
  onRemove: () => void;
  removing: boolean;
  // Why removing it was just refused.
  refusal?: string;
  calendar?: ReactNode;
  // The sheet's close button, beside the heading.
  dismiss?: ReactNode;
}) {
  const t = useTranslations("Rsvp");
  const format = useFormatter();
  const [copied, setCopied] = useState(false);
  const named = answer.plusOneNames.filter(Boolean);

  return (
    <>
      <div className="flex items-start gap-3">
        <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-theme-accent text-theme-on-accent">
          <Check className="size-5" />
        </span>
        <div className="flex-1">
          <p className="font-title text-3xl leading-tight">{t(`done.${answer.status}`)}</p>
          <p className="text-sm text-theme-text-muted">
            {answer.status === "cant"
              ? t("summary.cant", { name: answer.name })
              : t("summary.coming", { name: answer.name, count: answer.plusOnes })}
          </p>
          {named.length > 0 && <p className="text-sm text-theme-text-faint">{t("summary.bringing", { names: format.list(named) })}</p>}
          {answer.email && <p className="text-sm text-theme-text-faint">{t("summary.email", { email: answer.email })}</p>}
        </div>
        {dismiss}
      </div>

      {calendar && answer.status !== "cant" && <div className="mt-4">{calendar}</div>}

      <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-theme-glass-strong px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-xs tracking-wider text-theme-text-faint uppercase">{t("editLink.label")}</p>
          <p className="truncate font-mono text-[13px]">{answer.editLink}</p>
        </div>
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(answer.editLink).then(() => setCopied(true))}
          className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-theme-glass px-3 text-xs font-medium hover:bg-theme-glass-strong"
        >
          <Copy className="size-3.5" aria-hidden /> {copied ? t("editLink.copied") : t("editLink.copy")}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-theme-text-muted">
        <span>{t("editLink.hint")}</span>
        <button type="button" onClick={onChangeAnswer} className="cursor-pointer underline underline-offset-2 hover:opacity-80">
          {t("change")}
        </button>
        <button type="button" onClick={onEditDetails} className="cursor-pointer underline underline-offset-2 hover:opacity-80">
          {t("edit")}
        </button>
        <button
          type="button"
          onClick={onRemove}
          disabled={removing}
          className="cursor-pointer text-theme-accent-ink underline underline-offset-2 hover:opacity-80 disabled:opacity-50"
        >
          {t("remove")}
        </button>
      </div>
      {refusal && (
        <p role="alert" className="mt-3 text-sm font-medium">
          {refusal}
        </p>
      )}
    </>
  );
}
