"use client";

import { Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { pickDateAction, savePollAction } from "@/events/editor-actions";
import { MAX_OPTIONS, MIN_OPTIONS, type OptionInput } from "@/polls/poll";
import { Footer, useSaving } from "./saving";

// The poll as the When sheet shows it (M4 ticket 09), worked out on the server: each candidate as
// typed and as read, with its votes, and whether most can make it.
export type EditablePoll = {
  open: boolean;
  // Whether this event may become a poll now: a draft whose poll was never closed.
  canStart: boolean;
  voters: number;
  options: (OptionInput & { id: string; label: string; yes: string[]; ifNeedBe: string[]; no: string[]; leading: boolean })[];
};

const BLANK: OptionInput = { day: "", startTime: "", endTime: "" };

// "Not sure yet? Let guests vote": two to six candidates, each a day with an optional start and end
// time in the event's zone. Saved with Done; changed only while nobody has voted.
export function PollCandidates({ eventId, poll, onOpenChange, onSetDate }: { eventId: string; poll: EditablePoll; onOpenChange: (open: boolean) => void; onSetDate: () => void }) {
  const t = useTranslations("Editor");
  const id = useId();
  const saving = useSaving(onOpenChange);
  const [rows, setRows] = useState<OptionInput[]>(() =>
    poll.options.length >= MIN_OPTIONS ? poll.options.map(({ day, startTime, endTime }) => ({ day, startTime, endTime })) : [BLANK, BLANK],
  );
  const change = (index: number, field: keyof OptionInput, value: string) => setRows((all) => all.map((row, at) => (at === index ? { ...row, [field]: value } : row)));

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void saving.run(() => savePollAction(eventId, rows));
      }}
    >
      <FieldGroup>
        <p className="text-sm text-muted-foreground">{t("poll.pollIntro")}</p>
        <ol className="flex flex-col gap-4">
          {rows.map((row, index) => {
            const n = index + 1;
            return (
              <li key={index} className="flex flex-col gap-2 rounded-2xl border p-3">
                <div className="flex items-end gap-2">
                  <Field className="flex-1">
                    <FieldLabel htmlFor={`${id}-${index}-day`}>{t("poll.candidate", { n })}</FieldLabel>
                    <Input id={`${id}-${index}-day`} type="date" value={row.day} onChange={(event) => change(index, "day", event.target.value)} />
                  </Field>
                  {rows.length > MIN_OPTIONS && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t("poll.removeCandidate", { n })}
                      onClick={() => setRows((all) => all.filter((_, at) => at !== index))}
                    >
                      <X aria-hidden />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field>
                    <FieldLabel htmlFor={`${id}-${index}-start`} className="text-xs">
                      {t("poll.startTime", { n })}
                    </FieldLabel>
                    <Input id={`${id}-${index}-start`} type="time" value={row.startTime} onChange={(event) => change(index, "startTime", event.target.value)} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`${id}-${index}-end`} className="text-xs">
                      {t("poll.endTime", { n })}
                    </FieldLabel>
                    <Input id={`${id}-${index}-end`} type="time" value={row.endTime} onChange={(event) => change(index, "endTime", event.target.value)} />
                  </Field>
                </div>
              </li>
            );
          })}
        </ol>
        {rows.length < MAX_OPTIONS && (
          <Button type="button" variant="outline" className="self-start" onClick={() => setRows((all) => [...all, BLANK])}>
            <Plus aria-hidden />
            {t("poll.addCandidate")}
          </Button>
        )}
        <Footer pending={saving.pending} error={saving.error} label={t("done")} />
        <Button type="button" variant="ghost" onClick={onSetDate}>
          {t("poll.setDateInstead")}
        </Button>
      </FieldGroup>
    </form>
  );
}

// The votes per candidate, with who said what, and "Pick this date", which is confirmed: the
// candidate becomes the date, the poll closes for good, and voters with an email are told.
export function PollVotes({ eventId, poll, onOpenChange }: { eventId: string; poll: EditablePoll; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("Editor");
  const saving = useSaving(onOpenChange);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{poll.voters === 0 ? t("poll.noVotesYet") : t("poll.votesIntro")}</p>
      <ul className="flex flex-col gap-3">
        {poll.options.map((option) => (
          <li key={option.id} className="flex flex-col gap-2 rounded-2xl border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{option.label}</p>
              {option.leading && <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">{t("poll.leading")}</span>}
            </div>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
              {(["yes", "ifNeedBe", "no"] as const).map((answer) => (
                <div key={answer} className="contents">
                  <dt className="text-muted-foreground">
                    {t(`poll.${answer}`)} · {option[answer].length}
                  </dt>
                  <dd className="break-words">{option[answer].join(", ") || "–"}</dd>
                </div>
              ))}
            </dl>
            {poll.open && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="outline" size="sm" className="self-start" aria-label={t("poll.pickLabel", { date: option.label })}>
                    {t("poll.pick")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("poll.pickTitle", { date: option.label })}</AlertDialogTitle>
                    <AlertDialogDescription>{t("poll.pickText")}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel type="button">{t("poll.pickKeep")}</AlertDialogCancel>
                    <Button type="button" disabled={saving.pending} onClick={() => void saving.run(() => pickDateAction(eventId, option.id))}>
                      {t("poll.pickConfirm")}
                    </Button>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </li>
        ))}
      </ul>
      {saving.error && (
        <p role="alert" className="text-sm text-destructive">
          {saving.error}
        </p>
      )}
    </div>
  );
}
