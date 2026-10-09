"use client";

import { Check, Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useRef, type ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { offeredBy } from "@/questions/answers";
import { RSVP_STATUSES, type RsvpStatus } from "@/rsvps/form";
import { Confetti } from "@/themes/effects/confetti";
import { Glass } from "@/themes/glass";
import { cardButtonClasses } from "@/themes/rsvp-buttons";
import { useTheme } from "@/themes/themed-page";
import { BroadsheetReceipt } from "./broadsheet-receipt";
import { Asked } from "./rsvp-flow";
import { useRsvpFlow, type RsvpFlowProps } from "./use-rsvp-flow";

// The Broadsheet's ballot (spec, "Broadsheet"): the RSVP flow's rules (use-rsvp-flow.ts) as one
// form on a glass card, which the layout keeps in view beside the text on a wide screen. The guest
// marks one of three answers, and everything the event asks of that answer opens beneath it at
// once: their name (and email, when the host asks), how many they bring and their names, the
// host's questions; then "Post my reply". Can't go asks only the name. Once saved, the card holds
// the receipt: a "Received" stamp, their answer and the private link that changes it.
//
// The card is the glass the Poster's own RSVP card is, and everything on it sits where it sits
// there (legibility.ts, SURFACES: text on the card, the accent filled or as ink on the card), so
// it reads under every theme. A mark that is chosen is drawn in the text's own colour, so it never
// rests on the accent alone. "Post my reply" wears the theme's RSVP button style.
export function BroadsheetBallot(props: RsvpFlowProps) {
  const { settings, open, questions, calendar } = props;
  const t = useTranslations("Rsvp");
  const { buttonStyle } = useTheme().resolved;
  const id = useId();
  const statusMarks = useRef<Partial<Record<RsvpStatus, HTMLInputElement | null>>>({});
  const receiptHeading = useRef<HTMLHeadingElement>(null);
  // Once the RSVP is saved the focus goes to the receipt's heading, which a screen reader reads
  // out; once it is removed or being changed, to the answer the guest is choosing from.
  const flow = useRsvpFlow(props, (target, status) => {
    if (target === "confirmation") receiptHeading.current?.focus();
    else statusMarks.current[status]?.focus();
  });
  const { draft, change, recordAnswer, steps, confirmed, answering, working } = flow;
  const chosen = answering ? draft.status : undefined;

  return (
    <>
      {/* Apart from the card, so going on from the receipt neither stops it nor starts it again. */}
      {flow.falls > 0 && <Confetti key={flow.falls} />}
      <Glass data-slot="ballot" className="rounded-[28px] p-6 sm:p-7">
        <div className="label-mono flex items-baseline justify-between gap-3 border-b border-theme-text/20 pb-3">
          <h2>{t("ballot.title")}</h2>
          {!confirmed && open && <span className="text-theme-text-muted">{t("ballot.pending")}</span>}
        </div>

        {confirmed ? (
          <BroadsheetReceipt
            answer={confirmed}
            headingRef={receiptHeading}
            onAmend={flow.editDetails}
            onChangeAnswer={flow.changeAnswer}
            onRemove={flow.withdraw}
            removing={working}
            refusal={flow.withdrawRefusal && t(`errors.${flow.withdrawRefusal}`)}
            calendar={calendar}
          />
        ) : (
          <form action={flow.send} className="mt-2 flex flex-col gap-6">
            <input type="hidden" name="plusOnes" value={draft.plusOnes} />
            <fieldset disabled={!open}>
              <legend className="sr-only">{t("sheet.title")}</legend>
              {RSVP_STATUSES.map((status) => (
                <label
                  key={status}
                  className={cn(
                    "flex items-center gap-4 border-b border-theme-text/20 py-3.5 text-2xl font-bold tracking-tight",
                    open ? "cursor-pointer" : "cursor-not-allowed text-theme-text-muted",
                    chosen !== undefined && chosen !== status && "text-theme-text-muted",
                  )}
                >
                  <Mark
                    ref={(input) => {
                      statusMarks.current[status] = input;
                    }}
                    type="radio"
                    name="status"
                    value={status}
                    checked={chosen === status}
                    onChange={() => flow.pick(status)}
                  />
                  {status === "maybe" ? t("maybe") : t(`ballot.${status}`)}
                </label>
              ))}
            </fieldset>
            {!open && <p className="-mt-2 text-sm text-theme-text-muted">{t("errors.closed")}</p>}

            {answering && (
              <>
                <label className="block">
                  <span className={LABEL}>{t("name.label")}</span>
                  <input
                    name="name"
                    value={draft.name}
                    onChange={(typed) => change({ name: typed.target.value })}
                    placeholder={t("name.placeholder")}
                    className={FIELD}
                  />
                </label>
                {settings.askEmail && (
                  <label className="block">
                    <span className={LABEL}>{t("name.email")}</span>
                    <input
                      // Not type="email", as on the Poster: the action checks the address and says
                      // what is wrong with it in the guest's language.
                      inputMode="email"
                      autoComplete="email"
                      name="email"
                      value={draft.email}
                      onChange={(typed) => change({ email: typed.target.value })}
                      className={FIELD}
                    />
                    <span className="mt-1 block text-xs text-theme-text-faint">{t("name.emailHint")}</span>
                  </label>
                )}

                {steps.includes("plusones") && (
                  <div role="group" aria-labelledby={`${id}-plus-ones`} aria-describedby={`${id}-plus-ones-hint`}>
                    <span id={`${id}-plus-ones`} className={LABEL}>
                      {t("ballot.plusOnes")}
                    </span>
                    <p id={`${id}-plus-ones-hint`} className="mb-2 text-sm text-theme-text-muted">
                      {t("plusOnes.hint", { count: settings.plusOnesAllowed })}
                    </p>
                    <div className="flex items-center gap-4">
                      <StepperButton label={t("ballot.fewer")} icon={Minus} at={draft.plusOnes === 0} onStep={() => change({ plusOnes: draft.plusOnes - 1 })} />
                      <span aria-live="polite" className="w-8 text-center font-mono text-2xl tabular-nums">
                        {draft.plusOnes}
                      </span>
                      <StepperButton label={t("ballot.more")} icon={Plus} at={draft.plusOnes >= settings.plusOnesAllowed} onStep={() => change({ plusOnes: draft.plusOnes + 1 })} />
                    </div>
                    {Array.from({ length: draft.plusOnes }, (_, index) => (
                      <label key={index} className="mt-3 block">
                        <span className="mb-0.5 block text-sm text-theme-text-muted">{t("plusOnes.guestName", { number: index + 1 })}</span>
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
                      </label>
                    ))}
                  </div>
                )}

                {steps.includes("questions") && (
                  <ol data-slot="questions" className="flex flex-col gap-6">
                    {questions.map((question) => {
                      const asked = <Asked question={question} optional={t("questions.optional")} required={t("questions.required")} />;
                      const given = draft.answers[question.id] ?? [];
                      return (
                        <li key={question.id}>
                          {question.type === "text" ? (
                            <label className="block">
                              <span className={PROMPT}>{asked}</span>
                              <textarea
                                name={`answer:${question.id}`}
                                rows={2}
                                value={given[0] ?? ""}
                                onChange={(typed) => recordAnswer(question.id, [typed.target.value])}
                                className={cn(FIELD, "h-auto py-2")}
                              />
                            </label>
                          ) : (
                            <fieldset>
                              <legend className={PROMPT}>{asked}</legend>
                              <div className="flex flex-col gap-2.5">
                                {(offeredBy(question) ?? []).map((option) => {
                                  const picked = given.includes(option);
                                  return (
                                    <label key={option} className="flex cursor-pointer items-center gap-3 text-lg">
                                      {question.type === "multiple" ? (
                                        // A checked box posts its own answer; unchecking takes a pick back.
                                        <Mark
                                          type="checkbox"
                                          name={`answer:${question.id}`}
                                          value={option}
                                          checked={picked}
                                          onChange={() => flow.pickOption(question, option)}
                                        />
                                      ) : (
                                        <Mark
                                          type="radio"
                                          name={`answer:${question.id}`}
                                          value={option}
                                          checked={picked}
                                          onChange={() => flow.pickOption(question, option)}
                                          // Choosing the chosen answer again takes it back, as on the
                                          // Poster: the only way to leave an optional question unanswered.
                                          onClick={() => picked && flow.pickOption(question, option)}
                                        />
                                      )}
                                      {question.type === "yesNo" ? t(`questions.${option as "yes" | "no"}`) : option}
                                    </label>
                                  );
                                })}
                              </div>
                            </fieldset>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                )}

                {flow.refusal && (
                  <p role="alert" className="text-sm font-medium">
                    {t(`errors.${flow.refusal}`)}
                  </p>
                )}
                {/* In the theme's RSVP button style: the ballot's one button. */}
                <button
                  type="submit"
                  disabled={working || !draft.name.trim()}
                  className={cn(cardButtonClasses(buttonStyle), "h-14 justify-between px-5 text-lg font-bold tracking-tight")}
                >
                  {t("ballot.post")} <span aria-hidden>→</span>
                </button>
              </>
            )}
          </form>
        )}
      </Glass>
    </>
  );
}

const LABEL = "label-mono mb-1.5 block text-theme-text-muted";
const PROMPT = "mb-2 block font-medium";
const FIELD = "h-11 w-full border-b border-theme-text/40 bg-transparent text-lg text-theme-text placeholder:text-theme-text-faint";

// A radio button or a checkbox drawn as the ballot's mark: a ring or a box in the text's colour,
// filled once chosen. It is the input itself, so the keyboard's focus rings it.
function Mark({ type, className, ...props }: ComponentProps<"input"> & { type: "radio" | "checkbox" }) {
  return (
    <span className="relative grid size-6 shrink-0 place-items-center">
      <input
        type={type}
        className={cn(
          "peer size-6 cursor-[inherit] appearance-none border-2 border-current",
          type === "radio" ? "rounded-full" : "rounded-md checked:bg-current",
          className,
        )}
        {...props}
      />
      {type === "radio" ? (
        <span aria-hidden className="pointer-events-none absolute size-3 rounded-full bg-current opacity-0 peer-checked:opacity-100" />
      ) : (
        <Check aria-hidden strokeWidth={3} className="pointer-events-none absolute size-4 text-theme-base opacity-0 peer-checked:opacity-100" />
      )}
    </span>
  );
}

// One of the plus-ones stepper's two buttons. At its end it does nothing and says so, but keeps
// the focus, so a guest stepping down by keyboard is not dropped from the ballot.
function StepperButton({ label, icon: Icon, at, onStep }: { label: string; icon: typeof Plus; at: boolean; onStep: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-disabled={at}
      onClick={() => !at && onStep()}
      className="grid size-11 cursor-pointer place-items-center rounded-xl border border-theme-text/40 hover:bg-theme-glass-strong aria-disabled:cursor-default aria-disabled:opacity-40 aria-disabled:hover:bg-transparent"
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}
