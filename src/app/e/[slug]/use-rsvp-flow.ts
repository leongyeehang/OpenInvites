import { type ReactNode, useEffect, useEffectEvent, useRef, useState, useTransition } from "react";
import { answerAfterPicking, type AnswerFields } from "@/questions/answers";
import type { Question } from "@/questions/question";
import { removeRsvpAction, saveRsvpAction } from "@/rsvps/actions";
import { chosenStatus, type RsvpSettings, type RsvpStatus, type SavedStatus } from "@/rsvps/form";
import type { GuestRsvp, RsvpRefusal } from "@/rsvps/guest";
import { confettiFor } from "@/themes/effects/trigger";
import { useTheme } from "@/themes/themed-page";

// The guest's RSVP flow, as every layout shares it (spec, "Layouts"): where the guest is, what
// they have filled in so far, and what saving, removing or changing their answer does. Each
// layout presents it in its own way (the Poster's buttons and steps, the Broadsheet's ballot);
// the rules are here, once.

// Where the guest is in the flow (PROTOTYPE.md): choosing a status, then their name (with their
// email and phone number, when the host asks for them), then who they are bringing, then the
// host's questions, then, when the host has the email proven, the code sent to it, then the
// confirmation. A layout that asks everything at once treats every step but idle and done as
// "answering".
export type Step = "idle" | "name" | "plusones" | "questions" | "code" | "done";

// Which step holds the field a refusal is about, so a guest is never shown "fix your email"
// with the email field hidden two steps back. A refusal about no field in particular leaves the
// guest where they are, with the message in front of them.
const STEP_OF: Partial<Record<RsvpRefusal, Step>> = {
  nameRequired: "name",
  nameTooLong: "name",
  emailRequired: "name",
  emailInvalid: "name",
  phoneRequired: "name",
  phoneInvalid: "name",
  plusOnesInvalid: "plusones",
  capacityFull: "plusones",
  plusOneNameRequired: "plusones",
  plusOneNameTooLong: "plusones",
  answerRequired: "questions",
  answerNotOffered: "questions",
  answerTooLong: "questions",
  codeWrong: "code",
  codeExpired: "code",
  codeResent: "code",
  codeTooSoon: "code",
  codeTooFast: "code",
};

export type Draft = {
  status: RsvpStatus;
  name: string;
  plusOnes: number;
  plusOneNames: string[];
  email: string;
  phone: string;
  answers: AnswerFields;
  // The code the guest is typing on the code step.
  code: string;
};

const BLANK: Draft = { status: "going", name: "", plusOnes: 0, plusOneNames: [], email: "", phone: "", answers: {}, code: "" };

// Coming back to change an answer starts from the answer that is already there, a waitlisted one
// as the Going it asked for, except that a host who has since lowered the plus-ones allowance
// wins: otherwise the guest would carry an impossible number into every attempt to save, and never
// be able to change their RSVP again. A first answer through a personal invite starts from the name
// and the email the host gave, which the guest may change (spec, "Personal invite links").
function draftFrom(mine: GuestRsvp | undefined, settings: RsvpSettings, answers: AnswerFields, invite: Invited | undefined): Draft {
  if (!mine) return { ...BLANK, answers, ...(invite && { name: invite.name, email: invite.email ?? "" }) };
  const { name, plusOneNames, email, phone } = mine;
  const plusOnes = Math.min(mine.plusOnes, settings.plusOnesAllowed);
  return { status: chosenStatus(mine.status), name, plusOnes, plusOneNames: plusOneNames.slice(0, plusOnes), email: email ?? "", phone: phone ?? "", answers, code: "" };
}

// How a saved answer stands, which its confirmation says in every layout: what it says, Going, on
// the waitlist, Maybe or Can't go; or, until the host has approved it, that it waits for them or
// that they declined it (spec, "Approval").
export function confirmedAs(answer: GuestRsvp): SavedStatus | "pending" | "declined" {
  return answer.approval === "approved" ? answer.status : answer.approval;
}

// Whether the confirmation offers the calendar: to a guest on the list who may come, Going, Maybe
// or waiting for a place; not to one who can't go, nor to one whose reply the host has not
// approved, who is not on the list.
export function offersCalendar(answer: GuestRsvp): boolean {
  return answer.approval === "approved" && answer.status !== "cant";
}

// Whom the personal invite this device opened was made for, when the guest has not replied yet
// (invites/device.ts): the name, and the email the host gave, if any.
export type Invited = { name: string; email: string | null };

// What the event page hands whichever presentation of the flow its layout uses.
export type RsvpFlowProps = {
  slug: string;
  settings: RsvpSettings;
  mine: GuestRsvp | undefined;
  invite?: Invited;
  // Whether the event takes answers now (published), which decides whether a status can be chosen.
  open: boolean;
  // Whether the event has a capacity and the headcount has reached it, so a Going reply joins the
  // waitlist (rsvps/admission.ts, isFull).
  full: boolean;
  // Whether this guest's reply waits for the host's approval before it can take a place or wait for
  // one (spec, "Approval"): the event asks for approval, and the guest has no approved reply and did
  // not open a personal invite, whose reply is approved whatever the setting.
  awaitsApproval: boolean;
  questions: Question[];
  answers: AnswerFields;
  calendar?: ReactNode;
  // Turnstile's site key, when the operator has the check on (turnstile/turnstile.tsx).
  turnstileSiteKey?: string;
};

// Where the focus goes when what had it goes away under it: to the confirmation once an answer is
// saved, which a screen reader then reads out, back to the choice of status (at the status the
// guest is choosing from) once it is removed or being changed, or to the code's field once a code
// is sent. Only the presentation knows those elements.
export type Landing = "confirmation" | "status" | "code";

export function useRsvpFlow(
  { slug, settings, mine, invite, open, full, awaitsApproval, questions, answers, turnstileSiteKey }: RsvpFlowProps,
  land: (target: Landing, status: RsvpStatus) => void,
) {
  const { effect } = useTheme().theme;
  const [step, setStep] = useState<Step>(mine ? "done" : "idle");
  const [answer, setAnswer] = useState(mine);
  const [draft, setDraft] = useState<Draft>(() => draftFrom(mine, settings, answers, invite));
  const [refusal, setRefusal] = useState<RsvpRefusal>();
  // Why the guest's RSVP could not be removed just now, shown with their confirmation.
  const [withdrawRefusal, setWithdrawRefusal] = useState<"tooFast">();
  const [working, startWorking] = useTransition();
  const landing = useRef<Landing | null>(null);
  // Under the Confetti effect, how many answers saved here have made the guest Going: each one is
  // a fresh fall over the page.
  const [falls, setFalls] = useState(0);
  // The email the last code went to (rsvps/email-code.ts), how many codes have been sent here,
  // how many seconds until "Send it again" may ask for another, and, after a wrong code, how many
  // tries it has left.
  const [codeTo, setCodeTo] = useState<string>();
  const [codesSent, setCodesSent] = useState(0);
  const [resendIn, setResendIn] = useState(0);
  const [triesLeft, setTriesLeft] = useState<number>();
  // After a Going guest asked to bring more people than there is room for, how many places their
  // party may have.
  const [placesLeft, setPlacesLeft] = useState<number>();
  // The code step belongs to the email the code went to: a guest who changes the email is sent a
  // code to the new one when they answer again.
  const codeSentTo = codeTo !== undefined && codeTo === draft.email.trim() ? codeTo : undefined;
  // With Turnstile on, every post waits for the widget beside the layout's submit to pass (spec,
  // "Turnstile"): the answer that saves the reply or sends the code, "Send it again", and the code.
  // A token passes one check, so each post spends it, and once the answer is back the widget
  // starts again.
  const [checkPassed, setCheckPassed] = useState(false);
  const [checksSent, setChecksSent] = useState(0);
  const awaitingCheck = turnstileSiteKey !== undefined && !checkPassed;
  const turnstile = turnstileSiteKey === undefined ? undefined : { siteKey: turnstileSiteKey, onToken: setCheckPassed, resets: checksSent };

  // Declining takes two taps, so a guest who can't go is asked nothing else. Everyone else is
  // asked only what this event has to ask. Once a code is sent, entering it is the last step.
  const details: Step[] =
    draft.status === "cant"
      ? ["name"]
      : ["name", ...(settings.plusOnesAllowed > 0 ? (["plusones"] as const) : []), ...(questions.length > 0 ? (["questions"] as const) : [])];
  const steps: Step[] = codeSentTo === undefined ? details : [...details, "code"];
  const position = Math.max(0, steps.indexOf(step));
  const last = position === steps.length - 1;
  // The saved answer while the confirmation shows it.
  const confirmed = step === "done" ? answer : undefined;
  const answering = step !== "idle" && !confirmed;
  // What to say beside the choice of status when the event is full (spec, "Capacity and the
  // waitlist"): that a Going reply joins the waitlist, or, when it waits for the host's approval
  // first, that it joins it once approved. Whenever a guest may choose, not over their saved answer.
  const fullNotice: "full" | "fullApproval" | undefined = full && open && !confirmed ? (awaitsApproval ? "fullApproval" : "full") : undefined;

  const change = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));
  const recordAnswer = (questionId: string, values: string[]) =>
    setDraft((current) => ({ ...current, answers: { ...current.answers, [questionId]: values } }));
  // Picking one of a question's options, by the one rule every layout follows (answerAfterPicking).
  const pickOption = (question: Question, option: string) =>
    setDraft((current) => ({
      ...current,
      answers: { ...current.answers, [question.id]: answerAfterPicking(question, current.answers[question.id] ?? [], option) },
    }));

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
  }, [step, answer, codesSent]);

  // "Send it again" waits thirty seconds after each code, counting them down.
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((left) => left - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const send = (formData: FormData) => {
    // The code sent to this email moments ago is still the one to enter: an answer posted again
    // without it (the Broadsheet's "Post my reply" after "Change email" changed nothing) goes back
    // to it, as the Poster's Continue does, rather than asking for another too soon.
    if (codeSentTo !== undefined && resendIn > 0 && !formData.has("code")) {
      setRefusal(undefined);
      landing.current = "code";
      setStep("code");
      return;
    }
    setCheckPassed(false);
    startWorking(async () => {
      const result = await saveRsvpAction(slug, formData);
      setChecksSent((count) => count + 1);
      setRefusal(result.error);
      setTriesLeft(result.triesLeft);
      setPlacesLeft(result.placesLeft);
      if (result.codeSent) {
        // A code is on its way to the email the guest gave, or went there moments ago: they enter
        // it next, in a field emptied for it.
        landing.current = "code";
        setCodeTo(result.codeSent.email);
        setCodesSent((count) => count + 1);
        setResendIn(result.codeSent.resendIn);
        change({ code: "" });
        setStep("code");
        return;
      }
      if (result.error) {
        const owner = STEP_OF[result.error];
        if (owner && steps.includes(owner)) setStep(owner);
        return;
      }
      if (!result.saved) return;
      landing.current = "confirmation";
      if (effect === "confetti" && confettiFor(answer ?? null, result.saved)) setFalls((count) => count + 1);
      setAnswer(result.saved);
      setStep("done");
    });
  };

  const withdraw = () =>
    startWorking(async () => {
      const result = await removeRsvpAction(slug);
      setWithdrawRefusal(result.error);
      if (result.error) return;
      landing.current = "status";
      setAnswer(undefined);
      setDraft(BLANK);
      setCodeTo(undefined);
      setStep("idle");
    });

  // "Send it again": the answer as it stands, without the code typed so far, which asks for a new
  // code (rsvps/email-code.ts).
  const resend = (form: HTMLFormElement | null) => {
    if (!form) return;
    const answerOnly = new FormData(form);
    answerOnly.delete("code");
    send(answerOnly);
  };
  // From the code step back to the email, which is asked with the name.
  const changeEmail = () => {
    setRefusal(undefined);
    setStep("name");
  };

  // From the confirmation: back to choosing a status, keeping the name; or back to the details.
  // Either is a new answer, whose email is proven again only if it changes.
  const changeAnswer = () => {
    setWithdrawRefusal(undefined);
    setCodeTo(undefined);
    landing.current = "status";
    setStep("idle");
  };
  const editDetails = () => {
    setWithdrawRefusal(undefined);
    setCodeTo(undefined);
    setStep("name");
  };

  return {
    step,
    draft,
    change,
    recordAnswer,
    pickOption,
    steps,
    position,
    last,
    answer,
    confirmed,
    answering,
    refusal,
    // The number a refusal's sentence counts: tries left on a code, or places left for a party.
    refusalCount: placesLeft ?? triesLeft ?? 0,
    withdrawRefusal,
    working,
    falls,
    fullNotice,
    turnstile,
    awaitingCheck,
    codeSentTo,
    resendIn,
    pick,
    forward,
    back,
    stopAnswering,
    send,
    resend,
    changeEmail,
    withdraw,
    changeAnswer,
    editDetails,
  };
}

export type RsvpFlowState = ReturnType<typeof useRsvpFlow>;
