"use client";

import { Check, ChevronLeft, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { removeRsvpAction, saveRsvpAction } from "@/rsvps/actions";
import { offeredBy } from "@/questions/answers";
import type { Question } from "@/questions/question";
import { RSVP_STATUSES, type RsvpSettings, type RsvpStatus } from "@/rsvps/form";
import type { GuestRsvp, RsvpRefusal } from "@/rsvps/guest";
import { Glass } from "@/themes/glass";
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

// The guest's whole RSVP, inline under the poster: the three buttons, the stepper that expands
// beneath them, and, once they have answered, their confirmation. The Sheet style, where the
// same steps rise over the invitation instead, is ticket 11. The buttons wear the page's theme,
// which the host may be changing as the guest would see it.
export function RsvpFlow({ slug, settings, mine, open, questions, answers, calendar }: Props) {
  const t = useTranslations("Rsvp");
  const { buttonStyle } = useTheme().resolved;
  const [step, setStep] = useState<Step>(mine ? "done" : "idle");
  const [answer, setAnswer] = useState(mine);
  const [draft, setDraft] = useState<Draft>(() => draftFrom(mine, settings, answers));
  const [error, setError] = useState<RsvpRefusal>();
  const [working, startWorking] = useTransition();
  const form = useRef<HTMLFormElement>(null);

  // Declining takes two taps, so a guest who can't go is asked nothing else. Everyone else is
  // asked only what this event has to ask.
  const steps: Step[] =
    draft.status === "cant"
      ? ["name"]
      : ["name", ...(settings.plusOnesAllowed > 0 ? (["plusones"] as const) : []), ...(questions.length > 0 ? (["questions"] as const) : [])];
  const position = Math.max(0, steps.indexOf(step));
  const last = position === steps.length - 1;

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

  const pick = (status: RsvpStatus) => {
    change({ status, plusOnes: status === "cant" ? 0 : draft.plusOnes });
    setStep("name");
  };

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
      await removeRsvpAction(slug);
      setAnswer(undefined);
      setDraft(BLANK);
      setStep("idle");
    });

  if (answer && step === "done") {
    return (
      <Confirmation
        answer={answer}
        onChangeAnswer={() => setStep("idle")}
        onEditDetails={() => setStep("name")}
        onRemove={remove}
        removing={working}
        calendar={calendar}
      />
    );
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {RSVP_STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            disabled={!open}
            onClick={() => pick(status)}
            className={rsvpButtonClasses(buttonStyle, { selected: step !== "idle" && draft.status === status })}
          >
            {t(status)}
          </button>
        ))}
      </div>
      {/* Set on the page itself, so on the veil that keeps bare text readable. */}
      {!open && <p className="mx-auto mt-2 w-fit rounded-full bg-theme-veil px-3 py-1 text-center text-xs text-theme-text-faint backdrop-blur-xl">{t("errors.closed")}</p>}

      {step !== "idle" && (
        <Glass className="mt-3 p-5">
          <form
            ref={form}
            action={send}
            // Enter finishes a step rather than sending a half-filled RSVP.
            onKeyDown={(event) => {
              if (event.key !== "Enter" || last) return;
              event.preventDefault();
              if (draft.name.trim()) forward();
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

            <div hidden={step !== "name"} className="flex flex-col gap-4">
              <Labelled label={t("name.label")}>
                <input
                  autoFocus
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

            <div hidden={step !== "plusones"} className="flex flex-col gap-3">
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
                      "h-12 cursor-pointer rounded-xl text-base font-medium transition-colors",
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

            <div hidden={step !== "questions"}>
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
                                  "h-10 cursor-pointer rounded-full px-4 text-sm font-medium transition-colors",
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
              className="h-12 cursor-pointer rounded-2xl bg-theme-accent text-base font-medium text-theme-on-accent transition-opacity hover:opacity-90 disabled:cursor-default disabled:opacity-50"
            >
              {last ? t("send") : t("continue")}
            </button>
          </form>
        </Glass>
      )}
    </div>
  );
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
  calendar,
}: {
  answer: GuestRsvp;
  onChangeAnswer: () => void;
  onEditDetails: () => void;
  onRemove: () => void;
  removing: boolean;
  calendar?: ReactNode;
}) {
  const t = useTranslations("Rsvp");
  const [copied, setCopied] = useState(false);
  const named = answer.plusOneNames.filter(Boolean);

  return (
    <Glass className="p-5">
      <div className="flex items-start gap-3">
        <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-theme-accent text-theme-on-accent">
          <Check className="size-5" />
        </span>
        <div>
          <p className="font-title text-3xl leading-tight">{t(`done.${answer.status}`)}</p>
          <p className="text-sm text-theme-text-muted">
            {answer.status === "cant"
              ? t("summary.cant", { name: answer.name })
              : t("summary.coming", { name: answer.name, count: answer.plusOnes })}
          </p>
          {named.length > 0 && <p className="text-sm text-theme-text-faint">{t("summary.bringing", { names: named.join(", ") })}</p>}
          {answer.email && <p className="text-sm text-theme-text-faint">{t("summary.email", { email: answer.email })}</p>}
        </div>
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
    </Glass>
  );
}
