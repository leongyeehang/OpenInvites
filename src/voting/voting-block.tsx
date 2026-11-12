"use client";

import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useEditor } from "@/editor/status";
import {
  addAwardAction,
  awardVotesAction,
  closeVotingAction,
  moveAwardAction,
  removeAwardAction,
  renameAwardAction,
  reopenVotingAction,
  setAwardScopeAction,
  setClosingTimeAction,
  setUploaderNamesAction,
  setWhoMayVoteAction,
  startVotingAction,
  turnOffVotingAction,
} from "./host-actions";
import {
  AWARD_SCOPES,
  MAX_AWARD_NAME,
  MAX_AWARDS,
  movedAwards,
  SUGGESTED_AWARDS,
  UPLOADER_NAMES,
  WHO_MAY_VOTE,
  type AwardScope,
  type UploaderNames,
  type VotingState,
  type WhoMayVote,
} from "./voting";

// One award as the block shows it (voting-settings.tsx): its id, none for Favourite before it is
// made; its name as shown, the translated "Favourite" for none; and what it is for.
export type BlockAward = { id: string | null; name: string; scope: AwardScope };

// The time voting closes by itself (M8 ticket 14), in the event's zone: as a datetime-local field
// holds it ("2026-10-03T19:00") and as the host reads it, or null for none; and the zone's name.
export type Closing = { wall: string | null; shown: string | null; timeZone: string };

// What an action answers when the press did not go through: refused by the site, or never answered.
type Refusal = "albumNotOpen" | "full" | "nameTooLong" | "last" | "past" | "invalid" | "refused" | "failed";

// The key a row goes by: Favourite before it is made has no id, and is then the only award.
const keyOf = (award: BlockAward) => award.id ?? "";

// The votes each award holds, read as a confirmation that deletes them opens (review fix, M8
// ticket 13), since the figure the page was drawn with may be old by the time the host presses.
// Until the read answers, the confirmation gives no figure and cannot be confirmed; if it fails,
// it says so, and only Never mind is left (review fix, ticket 14). An answer to an earlier opening
// is ignored.
type FreshVotes = { state: "reading" } | { state: "failed" } | { state: "read"; votes: Record<string, number> };

function useFreshVotes(eventId: string) {
  const [fresh, setFresh] = useState<FreshVotes>({ state: "reading" });
  const latest = useRef(0);
  const read = (open: boolean) => {
    if (!open) return;
    const mine = ++latest.current;
    const answered = (next: FreshVotes) => {
      if (mine === latest.current) setFresh(next);
    };
    setFresh({ state: "reading" });
    awardVotesAction(eventId).then(
      (votes) => answered(votes ? { state: "read", votes } : { state: "failed" }),
      () => answered({ state: "failed" }),
    );
  };
  // The votes of one award, or of every award, once read. Favourite before it is made holds none.
  const votesOf = (award?: BlockAward): number | undefined => {
    if (fresh.state !== "read") return undefined;
    if (!award) return Object.values(fresh.votes).reduce((sum, votes) => sum + votes, 0);
    return award.id === null ? 0 : (fresh.votes[award.id] ?? 0);
  };
  return { read, ready: fresh.state === "read", failed: fresh.state === "failed", votesOf };
}

// A confirmation's text: what it deletes, once the count is read (`votes`), or that it is being
// read, or that it could not be.
function CountText({ fresh, votes, text }: { fresh: Fresh; votes: number | undefined; text: (count: number) => string }) {
  const t = useTranslations("Voting.block");
  if (votes !== undefined) return text(votes);
  return t(fresh.failed ? "countFailed" : "counting");
}

// The album vote's block in the editor's Settings (M8 ticket 10), below the album's own and, like
// it, outside the sheet's form: Start voting, once the album is open; then Close voting or Reopen
// voting, and Turn off voting, confirmed with the number of votes it deletes. Each press is saved
// on its own through the editor's save status, and the page, refreshed by the action, draws the
// block in its new state; a press the site refuses, or that never reaches it, is reported there
// and undone on the screen, never shown as saved (review fix, ticket 13). Whatever the state, the
// awards (ticket 13), whether guests see who added each item (ticket 11), who may vote and the time
// voting closes by itself (ticket 14), saved the same way. While open, the way to tell guests: the
// Announcements page with the message written (ticket 14).
export function VotingBlock({
  eventId,
  state,
  albumOpen,
  awards,
  names,
  voters,
  closing,
}: {
  eventId: string;
  state: VotingState;
  albumOpen: boolean;
  awards: BlockAward[];
  names: UploaderNames;
  voters: WhoMayVote;
  closing: Closing;
}) {
  const t = useTranslations("Voting.block");
  const { save } = useEditor();
  const id = useId();
  const [confirming, setConfirming] = useState(false);
  const [shownNames, setShownNames] = useState(names);
  const [shownVoters, setShownVoters] = useState(voters);
  const fresh = useFreshVotes(eventId);
  const refusal = (error: Refusal) => {
    if (error === "albumNotOpen") return t("notYet");
    if (error === "full" || error === "nameTooLong") return t(`awards.${error}`);
    if (error === "past" || error === "invalid") return t(`closes.${error}`);
    return t("failed");
  };
  // A press saved through the editor's status: `undo` puts the screen back when it did not go through.
  const run = (action: () => Promise<{ error?: Refusal }>, undo?: () => void) =>
    save(async () => {
      let error: Refusal | undefined;
      try {
        error = (await action()).error;
      } catch {
        error = "failed";
      }
      if (error === undefined) return { saved: true };
      undo?.();
      return { saved: false, error: refusal(error) };
    });
  const chooseNames = (value: UploaderNames) => {
    const before = shownNames;
    setShownNames(value);
    void run(
      () => setUploaderNamesAction(eventId, value),
      () => setShownNames(before),
    );
  };
  const chooseVoters = (value: WhoMayVote) => {
    const before = shownVoters;
    setShownVoters(value);
    void run(
      () => setWhoMayVoteAction(eventId, value),
      () => setShownVoters(before),
    );
  };
  return (
    <FieldSet className="mt-6 gap-3" data-slot="voting-block" data-state={state}>
      <FieldLegend variant="label">{t("title")}</FieldLegend>
      {state === "off" ? (
        <>
          <FieldDescription>{t("intro")}</FieldDescription>
          <div>
            <Button
              type="button"
              variant="outline"
              disabled={!albumOpen}
              aria-describedby={albumOpen ? undefined : `${id}-not-yet`}
              onClick={() => void run(() => startVotingAction(eventId))}
            >
              {t("start")}
            </Button>
          </div>
          {!albumOpen && <FieldDescription id={`${id}-not-yet`}>{t("notYet")}</FieldDescription>}
        </>
      ) : (
        <>
          <p className="text-sm">{state === "closed" ? t("closed") : closing.shown ? t("closes.openUntil", { time: closing.shown }) : t("open")}</p>
          <div className="flex flex-wrap gap-2">
            {state === "open" ? (
              <Button type="button" variant="outline" onClick={() => void run(() => closeVotingAction(eventId))}>
                {t("close")}
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={() => void run(() => reopenVotingAction(eventId))}>
                {t("reopen")}
              </Button>
            )}
            <AlertDialog
              open={confirming}
              onOpenChange={(open) => {
                setConfirming(open);
                fresh.read(open);
              }}
            >
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive">
                  {t("turnOff")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <form
                  action={async () => {
                    await run(() => turnOffVotingAction(eventId));
                    setConfirming(false);
                  }}
                >
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("turnOffTitle")}</AlertDialogTitle>
                    <AlertDialogDescription>
                      <CountText fresh={fresh} votes={fresh.votesOf()} text={(count) => t("turnOffText", { count })} />
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="pt-4">
                    <AlertDialogCancel type="button">{t("cancel")}</AlertDialogCancel>
                    <Button type="submit" variant="destructive" disabled={!fresh.ready}>
                      {t("turnOffConfirm")}
                    </Button>
                  </AlertDialogFooter>
                </form>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          {state === "open" && (
            <Link href={`/events/${eventId}/announcements?draft=voting`} className="self-start text-sm underline underline-offset-4 hover:opacity-80">
              {t("announce")}
            </Link>
          )}
        </>
      )}
      <Field className="mt-3">
        <FieldLabel htmlFor={`${id}-voters`}>{t("who.title")}</FieldLabel>
        <NativeSelect id={`${id}-voters`} value={shownVoters} aria-describedby={`${id}-voters-hint`} onChange={(picked) => chooseVoters(picked.target.value as WhoMayVote)}>
          {WHO_MAY_VOTE.map((value) => (
            <NativeSelectOption key={value} value={value}>
              {t(`who.${value}`)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <FieldDescription id={`${id}-voters-hint`}>{t("who.hint")}</FieldDescription>
      </Field>
      <ClosingTime eventId={eventId} closing={closing} run={run} />
      <Awards eventId={eventId} awards={awards} run={run} fresh={fresh} />
      <FieldSet className="mt-3 gap-2" aria-describedby={`${id}-names-hint`}>
        <FieldLegend variant="label">{t("names.title")}</FieldLegend>
        {UPLOADER_NAMES.map((value) => (
          <Field key={value} orientation="horizontal">
            <input
              type="radio"
              id={`${id}-names-${value}`}
              name={`${id}-names`}
              value={value}
              checked={shownNames === value}
              onChange={() => chooseNames(value)}
              className="mt-0.5 size-4 shrink-0 accent-primary"
            />
            <FieldLabel htmlFor={`${id}-names-${value}`}>{t(`names.${value}`)}</FieldLabel>
          </Field>
        ))}
        <FieldDescription id={`${id}-names-hint`}>{t("names.hint")}</FieldDescription>
      </FieldSet>
    </FieldSet>
  );
}

type Run = (action: () => Promise<{ error?: Refusal }>, undo?: () => void) => Promise<boolean>;
type Fresh = ReturnType<typeof useFreshVotes>;

// The time voting closes by itself (M8 ticket 14), typed in the event's zone, which the hint names:
// saved when the field is left or on Enter, once, and cleared by No closing time alone. A time that
// has passed, or what is not a date and time, is refused, and the refusal shows under the field,
// which keeps what was typed for the host to put right.
//
// Review fixes (M8 ticket 15): a field read empty when left keeps the saved time and shows it
// again, since a date and time partly erased reads empty too; and a time typed whole is saved when
// the Settings sheet closes with the field still focused (Escape leaves it without a blur), not
// as it is typed, which would send each part Chrome reports on its way (the minute's "4" of "45").
function ClosingTime({ eventId, closing, run }: { eventId: string; closing: Closing; run: Run }) {
  const t = useTranslations("Voting.block.closes");
  const id = useId();
  const [typed, setTyped] = useState(closing.wall ?? "");
  const [problem, setProblem] = useState<"past" | "invalid">();
  const [drawn, setDrawn] = useState(closing.wall);
  if (drawn !== closing.wall) {
    setDrawn(closing.wall);
    setTyped(closing.wall ?? "");
    setProblem(undefined);
  }
  // The time last sent and the page's time it was sent over, so that Enter and the leaving after it
  // send it once.
  const sent = useRef<{ wall: string | null; over: string | null }>(undefined);

  const send = (wall: string | null) => {
    if (wall === closing.wall) return setProblem(undefined);
    if (sent.current && sent.current.wall === wall && sent.current.over === closing.wall) return;
    sent.current = { wall, over: closing.wall };
    setProblem(undefined);
    void run(async () => {
      const answer = await setClosingTimeAction(eventId, wall);
      if (answer.error === "past" || answer.error === "invalid") setProblem(answer.error);
      if (answer.error) sent.current = undefined;
      return answer;
    });
  };
  // Nothing typed, or a partly erased time, both read empty: the saved time stays, shown again.
  const sendTyped = () => (typed === "" ? setTyped(closing.wall ?? "") : send(typed));

  // The sheet closing unmounts the field without a blur: what was typed whole is sent then, once.
  const leaving = useRef(() => {});
  useEffect(() => {
    leaving.current = () => {
      if (typed !== "") send(typed);
    };
  });
  useEffect(() => () => leaving.current(), []);

  return (
    <Field>
      <FieldLabel htmlFor={`${id}-closes`}>{t("label")}</FieldLabel>
      <div className="flex flex-wrap gap-2">
        <Input
          id={`${id}-closes`}
          type="datetime-local"
          value={typed}
          aria-describedby={problem ? `${id}-problem ${id}-hint` : `${id}-hint`}
          aria-invalid={problem !== undefined || undefined}
          className="w-auto"
          onChange={(changed) => setTyped(changed.target.value)}
          onBlur={sendTyped}
          onKeyDown={(key) => {
            if (key.key !== "Enter") return;
            key.preventDefault();
            sendTyped();
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={closing.wall === null && typed === ""}
          onClick={() => {
            setTyped("");
            send(null);
          }}
        >
          {t("none")}
        </Button>
      </div>
      {problem && (
        <p id={`${id}-problem`} role="alert" className="text-sm text-destructive">
          {t(problem)}
        </p>
      )}
      <FieldDescription id={`${id}-hint`}>{t("hint", { zone: closing.timeZone })}</FieldDescription>
    </Field>
  );
}

// The awards (M8 ticket 13): one row per award, in the host's order, then a chip per suggestion no
// award is named yet, in the editor's language, and a field for an award of the host's own. Moving
// a row shows its new place at once, says it in a status line, and keeps the focus on the row's
// button (the other one where it reached an end); the page the action redraws confirms it.
function Awards({ eventId, awards, run, fresh }: { eventId: string; awards: BlockAward[]; run: Run; fresh: Fresh }) {
  const t = useTranslations("Voting.block.awards");
  const id = useId();
  const keys = awards.map(keyOf);
  const [order, setOrder] = useState(keys);
  const [drawnKeys, setDrawnKeys] = useState(keys.join());
  if (drawnKeys !== keys.join()) {
    setDrawnKeys(keys.join());
    setOrder(keys);
  }
  const [announced, setAnnounced] = useState("");
  const [own, setOwn] = useState("");
  const [adding, setAdding] = useState(false);
  const focusAfter = useRef<{ key: string; by: -1 | 1 }>(undefined);
  useEffect(() => {
    const moved = focusAfter.current;
    if (!moved) return;
    focusAfter.current = undefined;
    const button = (by: -1 | 1) => document.getElementById(`${id}-${moved.key}-${by === -1 ? "up" : "down"}`) as HTMLButtonElement | null;
    const same = button(moved.by);
    (same && !same.disabled ? same : button(moved.by === -1 ? 1 : -1))?.focus();
  }, [order, id]);

  const byKey = new Map(awards.map((award) => [keyOf(award), award]));
  const rows = order.flatMap((key) => byKey.get(key) ?? []);
  const full = awards.length >= MAX_AWARDS;
  const suggestions = SUGGESTED_AWARDS.map((suggestion) => ({ ...suggestion, name: t(`suggestions.${suggestion.key}`) })).filter((suggestion) => !awards.some((award) => award.name === suggestion.name));

  const move = (award: BlockAward, by: -1 | 1) => {
    if (award.id === null) return;
    const before = order;
    const after = movedAwards(order, award.id, by);
    focusAfter.current = { key: award.id, by };
    setOrder(after);
    setAnnounced(t("moved", { award: award.name, place: after.indexOf(award.id) + 1, count: after.length }));
    void run(
      () => moveAwardAction(eventId, award.id!, by),
      () => {
        setOrder(before);
        setAnnounced("");
      },
    );
  };
  const add = async (name: string, scope: AwardScope) => {
    setAdding(true);
    const added = await run(() => addAwardAction(eventId, name, scope));
    setAdding(false);
    return added;
  };
  const addOwn = async () => {
    if (own.trim() === "" || full || adding) return;
    if (await add(own, "all")) setOwn("");
  };

  return (
    <FieldSet className="mt-3 gap-2" aria-describedby={`${id}-hint`} data-slot="voting-awards">
      <FieldLegend variant="label">{t("title")}</FieldLegend>
      <FieldDescription id={`${id}-hint`}>{t("hint")}</FieldDescription>
      <ol className="flex flex-col gap-2">
        {rows.map((award, index) => (
          <AwardRow
            key={keyOf(award)}
            eventId={eventId}
            award={award}
            buttonId={`${id}-${keyOf(award)}`}
            first={index === 0}
            last={index === rows.length - 1}
            only={rows.length === 1}
            run={run}
            fresh={fresh}
            onMove={(by) => move(award, by)}
          />
        ))}
      </ol>
      <p role="status" className="sr-only">
        {announced}
      </p>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <Button
              key={suggestion.key}
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              disabled={full || adding}
              aria-describedby={full ? `${id}-full` : undefined}
              onClick={() => void add(suggestion.name, suggestion.scope)}
            >
              <Plus aria-hidden />
              {suggestion.name}
            </Button>
          ))}
        </div>
      )}
      <Field>
        <FieldLabel htmlFor={`${id}-own`}>{t("own")}</FieldLabel>
        <div className="flex gap-2">
          <Input
            id={`${id}-own`}
            value={own}
            maxLength={MAX_AWARD_NAME}
            disabled={full}
            aria-describedby={full ? `${id}-full` : undefined}
            onChange={(typed) => setOwn(typed.target.value)}
            onKeyDown={(key) => {
              if (key.key !== "Enter") return;
              key.preventDefault();
              void addOwn();
            }}
          />
          <Button type="button" variant="outline" disabled={full || adding || own.trim() === ""} aria-describedby={full ? `${id}-full` : undefined} onClick={() => void addOwn()}>
            {t("add")}
          </Button>
        </div>
      </Field>
      {full && <FieldDescription id={`${id}-full`}>{t("full")}</FieldDescription>}
    </FieldSet>
  );
}

// One award's row: its name, saved on blur and on Enter (nothing typed restores Favourite); what it
// is for, saved on change; Move up and Move down, disabled at the ends; and Remove, disabled for
// the last award, confirmed with the number of votes it deletes.
function AwardRow({
  eventId,
  award,
  buttonId,
  first,
  last,
  only,
  run,
  fresh,
  onMove,
}: {
  eventId: string;
  award: BlockAward;
  buttonId: string;
  first: boolean;
  last: boolean;
  only: boolean;
  run: Run;
  fresh: Fresh;
  onMove: (by: -1 | 1) => void;
}) {
  const t = useTranslations("Voting.block");
  const [removing, setRemoving] = useState(false);
  // The name being typed, or null to show the page's; the scope chosen, until the page's changes.
  const [draft, setDraft] = useState<string | null>(null);
  const [scope, setScope] = useState(award.scope);
  const [drawn, setDrawn] = useState({ name: award.name, scope: award.scope });
  if (drawn.name !== award.name || drawn.scope !== award.scope) {
    setDrawn({ name: award.name, scope: award.scope });
    if (drawn.name !== award.name) setDraft(null);
    if (drawn.scope !== award.scope) setScope(award.scope);
  }
  // The name last sent and the page's name it was sent over, so that Enter and the blur after it
  // send it once.
  const sent = useRef<{ typed: string; over: string }>(undefined);

  const rename = () => {
    if (draft === null) return;
    const typed = draft.trim();
    if (typed === award.name) return setDraft(null);
    if (sent.current?.typed === typed && sent.current.over === award.name) return;
    sent.current = { typed, over: award.name };
    void run(
      () => renameAwardAction(eventId, award.id, typed),
      () => {
        sent.current = undefined;
        setDraft(null);
      },
    ).then((saved) => {
      // Favourite again: the page's name shows, though it may be the one already shown.
      if (!saved || typed !== "") return;
      sent.current = undefined;
      setDraft(null);
    });
  };
  const onEnter = (key: KeyboardEvent<HTMLInputElement>) => {
    if (key.key !== "Enter") return;
    key.preventDefault();
    rename();
  };
  const chooseScope = (value: AwardScope) => {
    const before = scope;
    setScope(value);
    void run(
      () => setAwardScopeAction(eventId, award.id, value),
      () => setScope(before),
    );
  };

  return (
    <li className="flex flex-col gap-2 rounded-xl bg-muted/40 p-3 ring-1 ring-foreground/10">
      <div className="flex items-center gap-1">
        <Input
          aria-label={t("awards.name", { award: award.name })}
          value={draft ?? award.name}
          maxLength={MAX_AWARD_NAME}
          onChange={(typed) => setDraft(typed.target.value)}
          onBlur={rename}
          onKeyDown={onEnter}
        />
        <Button type="button" variant="ghost" size="icon" id={`${buttonId}-up`} aria-label={t("awards.moveUp", { award: award.name })} disabled={first} onClick={() => onMove(-1)}>
          <ArrowUp />
        </Button>
        <Button type="button" variant="ghost" size="icon" id={`${buttonId}-down`} aria-label={t("awards.moveDown", { award: award.name })} disabled={last} onClick={() => onMove(1)}>
          <ArrowDown />
        </Button>
        <AlertDialog
          open={removing}
          onOpenChange={(open) => {
            setRemoving(open);
            fresh.read(open);
          }}
        >
          <AlertDialogTrigger asChild>
            <Button type="button" variant="ghost" size="icon" aria-label={t("awards.remove", { award: award.name })} disabled={only}>
              <X />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <form
              action={async () => {
                if (award.id !== null) await run(() => removeAwardAction(eventId, award.id!));
                setRemoving(false);
              }}
            >
              <AlertDialogHeader>
                <AlertDialogTitle>{t("awards.removeTitle", { award: award.name })}</AlertDialogTitle>
                <AlertDialogDescription>
                  <CountText fresh={fresh} votes={fresh.votesOf(award)} text={(count) => t("awards.removeText", { count })} />
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="pt-4">
                <AlertDialogCancel type="button">{t("cancel")}</AlertDialogCancel>
                <Button type="submit" variant="destructive" disabled={!fresh.ready}>
                  {t("awards.removeConfirm")}
                </Button>
              </AlertDialogFooter>
            </form>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      <NativeSelect aria-label={t("awards.scope", { award: award.name })} value={scope} onChange={(picked) => chooseScope(picked.target.value as AwardScope)}>
        {AWARD_SCOPES.map((value) => (
          <NativeSelectOption key={value} value={value}>
            {t(`awards.scopes.${value}`)}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </li>
  );
}
