import { type ReactNode, useEffect, useEffectEvent, useRef, useState, useTransition } from "react";
import type { AnswerFields } from "@/questions/answers";
import type { Question } from "@/questions/question";
import { removeRsvpAction, saveRsvpAction } from "@/rsvps/actions";
import type { RsvpSettings, RsvpStatus } from "@/rsvps/form";
import type { GuestRsvp, RsvpRefusal } from "@/rsvps/guest";
import { confettiFor } from "@/themes/effects/trigger";
import { useTheme } from "@/themes/themed-page";

// The guest's RSVP flow, as every layout shares it (spec, "Layouts"): where the guest is, what
// they have filled in so far, and what saving, removing or changing their answer does. Each
// layout presents it in its own way (the Poster's buttons and steps, the Broadsheet's ballot);
// the rules are here, once.

// Where the guest is in the flow (PROTOTYPE.md): choosing a status, then their name, then who
// they are bringing, then the host's questions, then the confirmation. A layout that asks
// everything at once treats every step but idle and done as "answering".
export type Step = "idle" | "name" | "plusones" | "questions" | "done";

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

export type Draft = {
  status: RsvpStatus;
  name: string;
  plusOnes: number;
  plusOneNames: string[];
  email: string;
  answers: AnswerFields;
};

const BLANK: Draft = { status: "going", name: "", plusOnes: 0, plusOneNames: [], email: "", answers: {} };

// Coming back to change an answer starts from the answer that is already there, except that a
// host who has since lowered the plus-ones allowance wins: otherwise the guest would carry an
// impossible number into every attempt to save, and never be able to change their RSVP again.
function draftFrom(mine: GuestRsvp | undefined, settings: RsvpSettings, answers: AnswerFields): Draft {
  if (!mine) return { ...BLANK, answers };
  const { status, name, plusOneNames, email } = mine;
  const plusOnes = Math.min(mine.plusOnes, settings.plusOnesAllowed);
  return { status, name, plusOnes, plusOneNames: plusOneNames.slice(0, plusOnes), email: email ?? "", answers };
}

// What the event page hands whichever presentation of the flow its layout uses.
export type RsvpFlowProps = {
  slug: string;
  settings: RsvpSettings;
  mine: GuestRsvp | undefined;
  // Whether the event takes answers now (published), which decides whether a status can be chosen.
  open: boolean;
  questions: Question[];
  answers: AnswerFields;
  calendar?: ReactNode;
};

// Where the focus goes when what had it goes away under it: to the confirmation once an answer is
// saved, which a screen reader then reads out, or back to the choice of status (at the status the
// guest is choosing from) once it is removed or being changed. Only the presentation knows those
// elements.
export type Landing = "confirmation" | "status";

export function useRsvpFlow(
  { slug, settings, mine, questions, answers }: RsvpFlowProps,
  land: (target: Landing, status: RsvpStatus) => void,
) {
  const { effect } = useTheme().theme;
  const [step, setStep] = useState<Step>(mine ? "done" : "idle");
  const [answer, setAnswer] = useState(mine);
  const [draft, setDraft] = useState<Draft>(() => draftFrom(mine, settings, answers));
  const [refusal, setRefusal] = useState<RsvpRefusal>();
  // Why the guest's RSVP could not be removed just now, shown with their confirmation.
  const [withdrawRefusal, setWithdrawRefusal] = useState<"tooFast">();
  const [working, startWorking] = useTransition();
  const landing = useRef<Landing | null>(null);
  // Under the Confetti effect, how many answers saved here have made the guest Going: each one is
  // a fresh fall over the page.
  const [falls, setFalls] = useState(0);

  // Declining takes two taps, so a guest who can't go is asked nothing else. Everyone else is
  // asked only what this event has to ask.
  const steps: Step[] =
    draft.status === "cant"
      ? ["name"]
      : ["name", ...(settings.plusOnesAllowed > 0 ? (["plusones"] as const) : []), ...(questions.length > 0 ? (["questions"] as const) : [])];
  const position = Math.max(0, steps.indexOf(step));
  const last = position === steps.length - 1;
  // The saved answer while the confirmation shows it.
  const confirmed = step === "done" ? answer : undefined;
  const answering = step !== "idle" && !confirmed;

  const change = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));
  const recordAnswer = (questionId: string, values: string[]) =>
    setDraft((current) => ({ ...current, answers: { ...current.answers, [questionId]: values } }));

  const pick = (status: RsvpStatus) => {
    change({ status, plusOnes: status === "cant" ? 0 : draft.plusOnes });
    setStep("name");
  };
  const forward = () => setStep(steps[position + 1]);
  const back = () => setStep(position === 0 ? "idle" : steps[position - 1]);
  // Leaving part-way leaves the RSVP as it was: the saved one, if there is one.
  const stopAnswering = () => {
    if (step !== "done") setStep(answer ? "done" : "idle");
  };

  // Once what had the focus has gone, and what replaces it is drawn, the presentation moves the
  // focus there.
  const onLanding = useEffectEvent((target: Landing) => land(target, draft.status));
  useEffect(() => {
    const target = landing.current;
    landing.current = null;
    if (target) onLanding(target);
  }, [step, answer]);

  const send = (formData: FormData) =>
    startWorking(async () => {
      const result = await saveRsvpAction(slug, formData);
      setRefusal(result.error);
      if (result.error) {
        const owner = STEP_OF[result.error];
        if (owner && steps.includes(owner)) setStep(owner);
        return;
      }
      if (!result.saved) return;
      landing.current = "confirmation";
      if (effect === "confetti" && confettiFor(answer?.status ?? null, result.saved.status)) setFalls((count) => count + 1);
      setAnswer(result.saved);
      setStep("done");
    });

  const withdraw = () =>
    startWorking(async () => {
      const result = await removeRsvpAction(slug);
      setWithdrawRefusal(result.error);
      if (result.error) return;
      landing.current = "status";
      setAnswer(undefined);
      setDraft(BLANK);
      setStep("idle");
    });

  // From the confirmation: back to choosing a status, keeping the name; or back to the details.
  const changeAnswer = () => {
    setWithdrawRefusal(undefined);
    landing.current = "status";
    setStep("idle");
  };
  const editDetails = () => {
    setWithdrawRefusal(undefined);
    setStep("name");
  };

  return {
    step,
    draft,
    change,
    recordAnswer,
    steps,
    position,
    last,
    answer,
    confirmed,
    answering,
    refusal,
    withdrawRefusal,
    working,
    falls,
    pick,
    forward,
    back,
    stopAnswering,
    send,
    withdraw,
    changeAnswer,
    editDetails,
  };
}

export type RsvpFlowState = ReturnType<typeof useRsvpFlow>;
