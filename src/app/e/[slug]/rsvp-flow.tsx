"use client";

import { Check, ChevronLeft, Copy, X } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Dialog } from "radix-ui";
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { flushSync } from "react-dom";
import { cn } from "@/lib/utils";
import { offeredBy } from "@/questions/answers";
import type { Question } from "@/questions/question";
import { chosenStatus, RSVP_STATUSES, type RsvpStatus } from "@/rsvps/form";
import type { GuestRsvp } from "@/rsvps/guest";
import { Confetti } from "@/themes/effects/confetti";
import { sheetVariables } from "@/themes/resolve";
import { rsvpButtonClasses } from "@/themes/rsvp-buttons";
import { useTheme } from "@/themes/themed-page";
import { Turnstile } from "@/turnstile/turnstile";
import { useCopyLink } from "./use-copy-link";
import { confirmedAs, offersCalendar, useRsvpFlow, type RsvpFlowProps, type Step } from "./use-rsvp-flow";

// The guest's whole RSVP in the Poster layout (M4 spec, "The guest page"): a bar fixed to the
// foot of the screen, with the three buttons, or once they have answered, what they answered and
// Change; and the steps and the confirmation in a sheet that rises over the invitation from it
// (PROTOTYPE.md). The flow's rules are use-rsvp-flow.ts's; this is how the Poster presents them.
// The theme's RSVP style knob is kept but no longer read here: a reply always opens in the sheet.
// Everything wears the page's theme, which the host may be changing as the guest would see it.
export function RsvpFlow(props: RsvpFlowProps) {
  const { settings, open, questions, calendar } = props;
  const t = useTranslations("Rsvp");
  const { resolved } = useTheme();
  const { buttonStyle } = resolved;
  const form = useRef<HTMLFormElement>(null);
  // The sheet opens when the guest chooses a status or asks to change their reply, and hands
  // focus back to whichever button that was when it closes.
  const [sheetOpen, setSheetOpen] = useState(false);
  const opener = useRef<HTMLButtonElement | null>(null);
  const statusButtons = useRef<Partial<Record<RsvpStatus, HTMLButtonElement | null>>>({});
  const changeButton = useRef<HTMLButtonElement | null>(null);
  const followFocus = useRef(false);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const codeField = useRef<HTMLInputElement>(null);
  const id = useId();

  // Sending, removing or going back to change an answer takes away the button that was pressed.
  // The focus goes to the confirmation's heading once the answer is saved, which a screen reader
  // then reads out, and to the code's field once a code is sent; once it is removed or being
  // changed, the sheet, closing, hands it back to the bar itself. Nothing scrolls the page under
  // the sheet, which is fixed to the screen.
  const flow = useRsvpFlow(props, (target) => {
    if (target === "confirmation") confirmationHeading.current?.focus({ preventScroll: true });
    if (target === "code") codeField.current?.focus({ preventScroll: true });
  });
  const { step, draft, change, recordAnswer, steps, position, last, confirmed, answering, working } = flow;

  const headings: Partial<Record<Step, string>> = {
    name: t(draft.status === "cant" ? "name.cantTitle" : "name.title"),
    plusones: t("plusOnes.title"),
    questions: t("questions.title"),
    code: t("code.title"),
  };
  const confirming = step === "code";

  // Back from the code to the email, with the focus in it.
  const changeEmail = () => {
    flushSync(flow.changeEmail);
    form.current?.querySelector<HTMLInputElement>('input[name="email"]')?.focus({ preventScroll: true });
  };

  const openSheet = (from: HTMLButtonElement) => {
    opener.current = from;
    setSheetOpen(true);
  };
  // Closing the sheet part-way leaves the RSVP as it was: the saved one, if there is one.
  const closeSheet = () => {
    setSheetOpen(false);
    flow.stopAnswering();
  };
  // Once the sheet has gone, however it went (the guest may have changed or removed their answer
  // from inside it), it stays shut, and focus goes back to the bar: to what opened it or, when that
  // has gone too, to the button for the status they are choosing from, or to Change.
  const sheetClosed = () => {
    setSheetOpen(false);
    const back = [opener.current, statusButtons.current[draft.status], changeButton.current].find((button) => button?.isConnected);
    back?.focus();
  };

  const pick = (status: RsvpStatus, from: HTMLButtonElement) => {
    flow.pick(status);
    openSheet(from);
  };

  // Enter moves on from inside a step, which hides the field it was pressed in. Focus follows to
  // the new step, so the keyboard is never left on something hidden (and never let out of the
  // sheet that way).
  useEffect(() => {
    if (!followFocus.current) return;
    followFocus.current = false;
    form.current?.querySelector<HTMLElement>(`[data-step="${step}"] :is(input:not([type="hidden"]), textarea, button)`)?.focus({ preventScroll: true });
  }, [step]);

  const confirmation = confirmed && (
    <Confirmation
      answer={confirmed}
      headingRef={confirmationHeading}
      onChangeAnswer={flow.changeAnswer}
      onEditDetails={flow.editDetails}
      onRemove={flow.withdraw}
      removing={working}
      refusal={flow.withdrawRefusal && t(`errors.${flow.withdrawRefusal}`)}
      calendar={calendar}
      dismiss={
        <Dialog.Close
          aria-label={t("sheet.close")}
          className="-mt-1 -mr-2 grid size-9 shrink-0 cursor-pointer place-items-center rounded-full hover:bg-theme-glass"
        >
          <X className="size-5" aria-hidden />
        </Dialog.Close>
      }
    />
  );

  const stepper = answering && (
    <form
      ref={form}
      action={flow.send}
      // Enter in a field finishes its step rather than sending a half-filled RSVP. On a button it
      // does what the button says, so Back goes back and a plus-one chip is chosen.
      onKeyDown={(event) => {
        // While the last step waits for Turnstile's check, Enter in a field sends nothing, as its
        // button does not: the browser would otherwise send a step with one field by itself.
        if (event.key === "Enter" && last && flow.awaitingCheck && event.target instanceof HTMLInputElement) {
          event.preventDefault();
          return;
        }
        // In the code's field, Enter confirms it.
        if (event.key === "Enter" && confirming && event.target === codeField.current) {
          event.preventDefault();
          if (draft.code.trim() && !working) form.current?.requestSubmit();
          return;
        }
        if (event.key !== "Enter" || last || !(event.target instanceof HTMLInputElement)) return;
        event.preventDefault();
        if (!draft.name.trim()) return;
        followFocus.current = true;
        flow.forward();
      }}
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="status" value={draft.status} />
      <input type="hidden" name="plusOnes" value={draft.plusOnes} />

      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={flow.back}
          aria-label={t("back")}
          className="-ml-1 grid size-9 shrink-0 cursor-pointer place-items-center rounded-full hover:bg-theme-glass"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <div className="flex-1">
          <span className="sr-only">{t("step", { step: position + 1, total: steps.length })}</span>
          <div aria-hidden className="mb-1.5 flex gap-1">
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
        {settings.emailField !== "none" && (
          <Labelled
            label={t("name.email")}
            required={settings.emailField === "required"}
            hint={t(settings.emailField === "required" ? "name.emailHintRequired" : "name.emailHint")}
          >
            <input
              // Not type="email", nor required: on a later step this field is hidden, and a
              // browser cannot show a validation bubble on something it cannot focus, so it
              // would block the send in silence. The action checks the address instead.
              inputMode="email"
              autoComplete="email"
              aria-required={settings.emailField === "required" || undefined}
              name="email"
              value={draft.email}
              onChange={(typed) => change({ email: typed.target.value })}
              className={FIELD}
            />
          </Labelled>
        )}
        {settings.phoneField !== "none" && (
          <Labelled
            label={t("name.phone")}
            required={settings.phoneField === "required"}
            hint={t(settings.phoneField === "required" ? "name.phoneHintRequired" : "name.phoneHint")}
          >
            <input
              // Not required, as the email is not; the action checks the number.
              inputMode="tel"
              autoComplete="tel"
              aria-required={settings.phoneField === "required" || undefined}
              name="phone"
              value={draft.phone}
              onChange={(typed) => change({ phone: typed.target.value })}
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
                    <Asked question={question} optional={t("questions.optional")} required={t("questions.required")} />
                  </span>
                  <textarea
                    name={`answer:${question.id}`}
                    rows={2}
                    value={draft.answers[question.id]?.[0] ?? ""}
                    onChange={(typed) => recordAnswer(question.id, [typed.target.value])}
                    className={cn(FIELD, "h-auto py-3")}
                  />
                </label>
              ) : question.type === "multiple" ? (
                <fieldset>
                  <legend className="mb-1.5 text-sm text-theme-text-muted">
                    <Asked question={question} optional={t("questions.optional")} required={t("questions.required")} />
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {question.options.map((option) => {
                      const picks = draft.answers[question.id] ?? [];
                      const chosen = picks.includes(option);
                      return (
                        // A checked box posts its own answer, so the step needs no hidden inputs
                        // while it is out of sight; unchecking is how a pick is taken back.
                        <label
                          key={option}
                          className={cn(
                            "relative flex h-10 cursor-pointer items-center rounded-full px-4 text-sm font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-theme-accent motion-reduce:transition-none",
                            chosen ? "bg-theme-accent text-theme-on-accent" : "bg-theme-glass-strong hover:bg-theme-glass",
                          )}
                        >
                          <input
                            type="checkbox"
                            name={`answer:${question.id}`}
                            value={option}
                            checked={chosen}
                            onChange={() => flow.pickOption(question, option)}
                            className="absolute inset-0 size-full cursor-pointer opacity-0"
                          />
                          {option}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ) : (
                <fieldset>
                  <legend className="mb-1.5 text-sm text-theme-text-muted">
                    <Asked question={question} optional={t("questions.optional")} required={t("questions.required")} />
                  </legend>
                  <input type="hidden" name={`answer:${question.id}`} value={draft.answers[question.id]?.[0] ?? ""} />
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={question.prompt}>
                    {(offeredBy(question) ?? []).map((option) => {
                      const chosen = draft.answers[question.id]?.[0] === option;
                      return (
                        <button
                          key={option}
                          type="button"
                          role="radio"
                          aria-checked={chosen}
                          // Tapping the chosen answer again takes it back, which is the
                          // only way to leave an optional question unanswered.
                          onClick={() => flow.pickOption(question, option)}
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

      {/* What the wait for "Send it again" is, said as the code step comes and as the wait ends
          (use-rsvp-flow.ts, resendNotice); here from the first step, so it is heard. */}
      <span aria-live="polite" className="sr-only">
        {flow.resendNotice === "now" ? t("code.resendNow") : flow.resendNotice && t("code.resendLater", { seconds: flow.resendNotice.waitFor })}
      </span>

      {/* The code sent to the guest's email, posted with the rest of the answer. */}
      {flow.codeSentTo !== undefined && (
        <div data-step="code" hidden={!confirming} className="flex flex-col gap-4">
          <p id={`${id}-code-sent`} className="text-sm break-words text-theme-text-muted">
            {t("code.sent", { email: flow.codeSentTo })}
          </p>
          <Labelled label={t("code.label")}>
            <input
              ref={codeField}
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              aria-describedby={`${id}-code-sent`}
              value={draft.code}
              onChange={(typed) => change({ code: typed.target.value })}
              className={FIELD}
            />
          </Labelled>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-theme-text-muted">
            {/* While it waits the button stays in the tab order, `aria-disabled` and a no-op, under the
                name it always has; the seconds it shows are its description, heard on reaching it. */}
            <button
              type="button"
              onClick={() => !(working || flow.resendIn > 0 || flow.awaitingCheck) && flow.resend(form.current)}
              aria-disabled={working || flow.resendIn > 0 || flow.awaitingCheck}
              aria-label={t("code.resend")}
              aria-describedby={flow.resendIn > 0 ? `${id}-resend-in` : undefined}
              className="cursor-pointer underline underline-offset-2 hover:opacity-80 aria-disabled:cursor-default aria-disabled:no-underline aria-disabled:opacity-70"
            >
              <span id={`${id}-resend-in`}>{flow.resendIn > 0 ? t("code.resendIn", { seconds: flow.resendIn }) : t("code.resend")}</span>
            </button>
            <button type="button" onClick={changeEmail} className="cursor-pointer underline underline-offset-2 hover:opacity-80">
              {t("code.changeEmail")}
            </button>
          </div>
        </div>
      )}

      {/* Turnstile, on the last step, whose button sends the answer: on the code step, beside
          "Send it again" and Confirm. */}
      {last && flow.turnstile && <Turnstile {...flow.turnstile} />}

      {flow.refusal && (
        <p role="alert" className="text-sm font-medium">
          {t(`errors.${flow.refusal}`, { count: flow.refusalCount })}
        </p>
      )}

      <button
        // Never type="submit": React would turn this very element into one as the step
        // changes, mid-click, and the browser would then send the half-filled form.
        type="button"
        onClick={() => (last ? form.current?.requestSubmit() : flow.forward())}
        disabled={working || !draft.name.trim() || (confirming && !draft.code.trim()) || (last && flow.awaitingCheck)}
        className="h-12 cursor-pointer rounded-2xl bg-theme-accent text-base font-medium text-theme-on-accent transition-opacity hover:opacity-90 disabled:cursor-default motion-reduce:transition-none disabled:opacity-50"
      >
        {confirming ? t("code.confirm") : last ? t("send") : t("continue")}
      </button>
    </form>
  );

  // What the buttons show as chosen while the guest is choosing again: the saved answer (Going for
  // a guest on the waitlist, which they asked for), else the one being given.
  const chosen = answering ? draft.status : flow.answer ? chosenStatus(flow.answer.status) : undefined;
  // Once they have answered, until they choose to answer again, the bar says what they answered.
  const replied = confirmed;

  // The confetti falls as the confirmation appears. It sits first, apart from whatever the flow
  // shows, so going on from the confirmation neither stops it nor starts it again.
  const confetti = flow.falls > 0 && <Confetti key={flow.falls} />;

  return (
    <>
      {confetti}
      {/* Fixed to the foot of the screen, inside the safe area, and on a wider screen to the foot of
          the page's column. It floats over whatever the page has under it there, so it is a surface
          of the sheet's kind, solved against anything (legibility.ts, SHEET_SURFACES). The page
          leaves room for it at its foot (themed-page.tsx). */}
      <div
        data-slot="rsvp-bar"
        className="fixed inset-x-3 bottom-[max(env(safe-area-inset-bottom),0.75rem)] z-40 mx-auto max-w-[26rem]"
        style={sheetVariables(resolved) as CSSProperties}
      >
        <div className="rounded-[1.6rem] border border-theme-glass-border bg-theme-sheet p-2 text-theme-text shadow-sheet backdrop-blur-2xl">
          {!open && <p className="px-2 pt-1 pb-2 text-center text-xs text-theme-text-faint">{t("errors.closed")}</p>}
          {flow.fullNotice && <p className="px-2 pt-1 pb-2 text-center text-xs text-theme-text-muted">{t(flow.fullNotice)}</p>}
          {replied ? (
            <div className="flex items-center gap-3 pl-3">
              <p className="min-w-0 flex-1 text-sm font-medium">{t(`bar.${confirmedAs(replied)}`, { position: replied.waitlistPosition ?? 0 })}</p>
              <button
                ref={changeButton}
                type="button"
                onClick={(event) => openSheet(event.currentTarget)}
                className="h-11 shrink-0 cursor-pointer rounded-2xl bg-theme-glass-strong px-4 text-sm font-medium hover:bg-theme-glass"
              >
                {t("bar.change")}
              </button>
            </div>
          ) : (
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
          )}
        </div>
      </div>
      <RsvpSheet open={sheetOpen && (answering || confirmed !== undefined)} onClose={closeSheet} onClosed={sheetClosed}>
        {confirmation || stepper}
      </RsvpSheet>
    </>
  );
}

// The sheet: a frosted sheet that rises from the foot of the screen over the
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
          className="fixed inset-x-3 bottom-[max(env(safe-area-inset-bottom),0.75rem)] z-60 mx-auto box-content flex max-w-[34rem] flex-col justify-end overflow-hidden rounded-[28px] border border-theme-glass-border bg-theme-sheet text-theme-text shadow-sheet backdrop-blur-2xl outline-none transition-[height] duration-300 ease-out motion-reduce:transition-none motion-safe:data-[state=closed]:animate-out motion-safe:data-[state=closed]:fade-out motion-safe:data-[state=closed]:slide-out-to-bottom-8 motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in motion-safe:data-[state=open]:slide-in-from-bottom-8"
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

// The prompt, and whether the host insists on an answer: an asterisk to the eye, the word to a
// screen reader. The Broadsheet's ballot asks the same way.
export function Asked({ question, optional, required }: { question: Question; optional: string; required: string }) {
  return (
    <>
      {question.prompt}
      {question.required ? (
        <>
          <span aria-hidden className="text-theme-accent-ink"> *</span>
          <span className="sr-only"> ({required})</span>
        </>
      ) : (
        <span className="text-theme-text-faint"> · {optional}</span>
      )}
    </>
  );
}

const FIELD =
  "h-12 w-full rounded-xl border border-theme-glass-border bg-theme-glass-strong px-4 text-base text-theme-text placeholder:text-theme-text-faint";

// A field with its label, and the hint under it. A field the host requires has an asterisk to the
// eye; its input says it is required to a screen reader.
function Labelled({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium tracking-wider text-theme-text-faint uppercase">
        {label}
        {required && <span aria-hidden className="text-theme-accent-ink"> *</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-theme-text-faint">{hint}</span>}
    </label>
  );
}

// What the guest sees once they have answered: their reply (or their place on the waitlist, or
// that it waits for the host's approval or was declined), the private link that changes it from
// any device, and the three ways out.
function Confirmation({
  answer,
  headingRef,
  onChangeAnswer,
  onEditDetails,
  onRemove,
  removing,
  refusal,
  calendar,
  dismiss,
}: {
  answer: GuestRsvp;
  // Where the focus lands once the answer is saved: the heading that says how it went.
  headingRef: RefObject<HTMLHeadingElement | null>;
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
  const shownLink = useRef<HTMLParagraphElement>(null);
  const link = useCopyLink(answer.editLink, shownLink);
  const named = answer.plusOneNames.filter(Boolean);
  const standing = confirmedAs(answer);

  return (
    <>
      <div className="flex items-start gap-3">
        {/* A tick for a reply the hosts took or have yet to answer; a declined one is not ticked. */}
        <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-theme-accent text-theme-on-accent">
          {standing === "declined" ? <X className="size-5" /> : <Check className="size-5" />}
        </span>
        <div className="flex-1">
          <h2 ref={headingRef} tabIndex={-1} className="font-title text-3xl leading-tight outline-none">
            {t(`done.${standing}`, { position: answer.waitlistPosition ?? 0 })}
          </h2>
          <p className="text-sm text-theme-text-muted">
            {answer.status === "cant"
              ? t("summary.cant", { name: answer.name })
              : t("summary.coming", { name: answer.name, count: answer.plusOnes })}
          </p>
          {named.length > 0 && <p className="text-sm text-theme-text-faint">{t("summary.bringing", { names: format.list(named) })}</p>}
          {answer.email && <p className="text-sm text-theme-text-faint">{t("summary.email", { email: answer.email })}</p>}
          {answer.phone && <p className="text-sm text-theme-text-faint">{t("summary.phone", { phone: answer.phone })}</p>}
        </div>
        {dismiss}
      </div>

      {calendar && offersCalendar(answer) && <div className="mt-4">{calendar}</div>}

      <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-theme-glass-strong px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-xs tracking-wider text-theme-text-faint uppercase">{t("editLink.label")}</p>
          <p ref={shownLink} className={cn("font-mono text-[13px]", link.failed ? "break-all" : "truncate")}>
            {answer.editLink}
          </p>
        </div>
        <button
          type="button"
          onClick={link.copy}
          className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-theme-glass px-3 text-xs font-medium hover:bg-theme-glass-strong"
        >
          <Copy className="size-3.5" aria-hidden /> {link.copied ? t("editLink.copied") : t("editLink.copy")}
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
