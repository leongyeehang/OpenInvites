"use client";

import { Vote } from "lucide-react";
import { useTranslations } from "next-intl";
import { Dialog } from "radix-ui";
import { createContext, use, useRef, useState, useTransition, type CSSProperties, type ReactNode } from "react";
import { voteAction, type VoteRefusal, type VoteResult } from "@/polls/actions";
import { VOTE_ANSWERS, type VoteAnswer } from "@/polls/poll";
import { PinnedBar } from "@/themes/pinned-bar";
import { sheetVariables } from "@/themes/resolve";
import { rsvpButtonClasses } from "@/themes/rsvp-buttons";
import { useTheme } from "@/themes/themed-page";
import { Turnstile } from "@/turnstile/turnstile";
import { cn } from "@/lib/utils";

// The date poll on the guest page (M4 ticket 09): until the host picks the date, the When row reads
// "Date to be decided" with the candidates, and the bar at the foot of the screen reads "Vote on a
// date". Either opens the sheet, where a guest gives their name, an email if they want the outcome,
// and Yes, If need be or No on every candidate. Their votes come back on this device, and by the
// private link the sheet gives them.

export type PollCandidate = { id: string; label: string; yes: number };

export type MyVotes = { name: string; email: string | null; votes: Record<string, VoteAnswer>; editLink: string };

type PollContext = { open: (opener: HTMLElement) => void; mine?: MyVotes; votable: boolean };

const Context = createContext<PollContext>({ open: () => {}, votable: false });

export function PollFlow({
  slug,
  candidates,
  mine,
  votable,
  turnstileSiteKey,
  children,
}: {
  slug: string;
  candidates: PollCandidate[];
  mine?: MyVotes;
  // Whether this event takes votes now: published, not cancelled, its poll open (polls/poll.ts).
  votable: boolean;
  turnstileSiteKey?: string;
  children: ReactNode;
}) {
  const [opened, setOpened] = useState(false);
  const [saved, setSaved] = useState<MyVotes | undefined>(mine);
  const opener = useRef<HTMLElement | null>(null);
  return (
    <Context
      value={{
        open: (element) => {
          opener.current = element;
          setOpened(true);
        },
        mine: saved,
        votable,
      }}
    >
      {children}
      <VoteSheet
        open={opened}
        onClose={() => setOpened(false)}
        onClosed={() => opener.current?.focus()}
        slug={slug}
        candidates={candidates}
        mine={saved}
        onSaved={setSaved}
        turnstileSiteKey={turnstileSiteKey}
      />
    </Context>
  );
}

// What the When row says while the date is being decided: the candidates with how many said Yes,
// and the way into the vote.
export function PollWhen({ candidates }: { candidates: PollCandidate[] }) {
  const t = useTranslations("EventPage.poll");
  const { open, mine, votable } = use(Context);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-base leading-snug font-medium">{t("toBeDecided")}</p>
      <ul className="flex flex-col gap-1.5 text-sm">
        {candidates.map((candidate) => (
          <li key={candidate.id} className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span>{candidate.label}</span>
            <span className="text-theme-text-muted tabular-nums">{t("yesCount", { count: candidate.yes })}</span>
          </li>
        ))}
      </ul>
      {votable && (
        <button
          type="button"
          onClick={(event) => open(event.currentTarget)}
          className="inline-flex h-10 cursor-pointer items-center gap-2 self-start rounded-full bg-theme-glass-strong px-4 text-sm font-medium hover:bg-theme-glass"
        >
          <Vote className="size-4" aria-hidden />
          {mine ? t("changeVotes") : t("vote")}
        </button>
      )}
    </div>
  );
}

// The bar fixed to the foot of the screen, where the reply buttons are once the date is set.
export function PollBar() {
  const t = useTranslations("EventPage.poll");
  const { open, mine, votable } = use(Context);
  const { resolved } = useTheme();
  if (!votable) return null;
  return (
    <PinnedBar slot="rsvp-bar">
      {mine ? (
        <div className="flex items-center gap-3 pl-3">
          <p className="min-w-0 flex-1 text-sm font-medium">{t("sent", { name: mine.name })}</p>
          <button
            type="button"
            onClick={(event) => open(event.currentTarget)}
            className="h-11 shrink-0 cursor-pointer rounded-2xl bg-theme-glass-strong px-4 text-sm font-medium hover:bg-theme-glass"
          >
            {t("changeVotes")}
          </button>
        </div>
      ) : (
        <button type="button" onClick={(event) => open(event.currentTarget)} className={cn(rsvpButtonClasses(resolved.buttonStyle, { selected: false }), "w-full")}>
          {t("vote")}
        </button>
      )}
    </PinnedBar>
  );
}

function VoteSheet({
  open,
  onClose,
  onClosed,
  slug,
  candidates,
  mine,
  onSaved,
  turnstileSiteKey,
}: {
  open: boolean;
  onClose: () => void;
  onClosed: () => void;
  slug: string;
  candidates: PollCandidate[];
  mine?: MyVotes;
  onSaved: (votes: MyVotes) => void;
  turnstileSiteKey?: string;
}) {
  const t = useTranslations("EventPage.poll");
  const { resolved, root } = useTheme();
  const [pending, start] = useTransition();
  const [refusal, setRefusal] = useState<VoteRefusal>();
  const [done, setDone] = useState(false);
  const [checked, setChecked] = useState(turnstileSiteKey === undefined);
  const [sent, setSent] = useState(0);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (next) return;
        onClose();
        setDone(false);
        setRefusal(undefined);
      }}
    >
      <Dialog.Portal container={root}>
        <Dialog.Content
          data-slot="poll-sheet"
          onPointerDownOutside={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            onClosed();
          }}
          style={sheetVariables(resolved) as CSSProperties}
          className="fixed inset-x-3 bottom-[max(env(safe-area-inset-bottom),0.75rem)] z-60 mx-auto flex max-h-[85dvh] max-w-[34rem] flex-col overflow-hidden rounded-[28px] border border-theme-glass-border bg-theme-sheet text-theme-text shadow-sheet backdrop-blur-2xl outline-none motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in motion-safe:data-[state=open]:slide-in-from-bottom-8"
        >
          <div className="overflow-y-auto overscroll-contain p-5">
            <Dialog.Title className="text-lg font-semibold">{t("title")}</Dialog.Title>
            {done && mine ? (
              <div className="mt-3 flex flex-col gap-3">
                <p role="status" className="font-medium">
                  {t("sent", { name: mine.name })}
                </p>
                <p className="text-sm text-theme-text-muted">{t("editLink")}</p>
                <p className="rounded-xl bg-theme-glass px-3 py-2 text-sm break-all">{mine.editLink}</p>
                <Dialog.Close className="h-11 cursor-pointer rounded-2xl bg-theme-glass-strong text-sm font-medium hover:bg-theme-glass">{t("close")}</Dialog.Close>
              </div>
            ) : (
              <form
                className="mt-1 flex flex-col gap-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  const data = new FormData(event.currentTarget);
                  start(async () => {
                    const result: VoteResult = await voteAction(slug, data);
                    setSent((count) => count + 1);
                    if (result.saved) {
                      onSaved(result.saved);
                      setRefusal(undefined);
                      setDone(true);
                    } else setRefusal(result.error);
                  });
                }}
              >
                <Dialog.Description className="text-sm text-theme-text-muted">{t("intro")}</Dialog.Description>
                {candidates.map((candidate) => (
                  <fieldset key={candidate.id} className="flex flex-col gap-2">
                    <legend className="mb-2 text-sm font-medium">{candidate.label}</legend>
                    <div className="grid grid-cols-3 gap-2">
                      {VOTE_ANSWERS.map((answer) => (
                        <label
                          key={answer}
                          className="relative flex h-11 cursor-pointer items-center justify-center rounded-2xl border border-theme-glass-border bg-theme-glass text-sm font-medium has-checked:border-theme-accent has-checked:bg-theme-accent has-checked:text-theme-on-accent has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-theme-text"
                        >
                          <input
                            type="radio"
                            name={`vote-${candidate.id}`}
                            value={answer}
                            defaultChecked={mine?.votes[candidate.id] === answer}
                            required
                            className="absolute inset-0 cursor-pointer appearance-none rounded-2xl"
                          />
                          {t(answer)}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ))}
                <label className="flex flex-col gap-1.5 text-sm font-medium">
                  {t("name")}
                  <input
                    name="name"
                    defaultValue={mine?.name}
                    required
                    maxLength={80}
                    autoComplete="name"
                    className="h-11 rounded-xl border border-theme-glass-border bg-theme-glass px-3 text-base font-normal"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium">
                  {t("email")}
                  <input
                    name="email"
                    type="email"
                    defaultValue={mine?.email ?? ""}
                    autoComplete="email"
                    aria-describedby="poll-email-hint"
                    className="h-11 rounded-xl border border-theme-glass-border bg-theme-glass px-3 text-base font-normal"
                  />
                  <span id="poll-email-hint" className="text-xs font-normal text-theme-text-muted">
                    {t("emailHint")}
                  </span>
                </label>
                {turnstileSiteKey && <Turnstile siteKey={turnstileSiteKey} onToken={setChecked} resets={sent} />}
                {refusal && (
                  <p role="alert" className="text-sm font-medium">
                    {t(`errors.${refusal}`)}
                  </p>
                )}
                <button type="submit" disabled={pending || !checked} className={cn(rsvpButtonClasses(resolved.buttonStyle, { selected: true }), "w-full")}>
                  {t("send")}
                </button>
              </form>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
