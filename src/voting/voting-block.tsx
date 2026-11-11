"use client";

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
import { Field, FieldDescription, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { useEditor } from "@/editor/status";
import { closeVotingAction, reopenVotingAction, setUploaderNamesAction, startVotingAction, turnOffVotingAction } from "./host-actions";
import { UPLOADER_NAMES, type UploaderNames, type VotingState } from "./voting";

// The album vote's block in the editor's Settings (M8 ticket 10), below the album's own and, like
// it, outside the sheet's form: Start voting, once the album is open; then Close voting or Reopen
// voting, and Turn off voting, confirmed with the number of votes it deletes. Each press is saved
// on its own through the editor's save status, and the page, refreshed by the action, draws the
// block in its new state. Whatever the state, whether guests see who added each item (ticket 11),
// saved on change the same way.
export function VotingBlock({ eventId, state, albumOpen, votes, names }: { eventId: string; state: VotingState; albumOpen: boolean; votes: number; names: UploaderNames }) {
  const t = useTranslations("Voting.block");
  const { save } = useEditor();
  const id = useId();
  const [confirming, setConfirming] = useState(false);
  const [shownNames, setShownNames] = useState(names);
  const run = (action: () => Promise<void>) =>
    save(async () => {
      await action();
      return { saved: true };
    });
  const start = () =>
    void save(async () => {
      const result = await startVotingAction(eventId);
      return result.error ? { saved: false, error: t("notYet") } : { saved: true };
    });
  const chooseNames = (value: UploaderNames) => {
    setShownNames(value);
    void run(() => setUploaderNamesAction(eventId, value));
  };
  return (
    <FieldSet className="mt-6 gap-3" data-slot="voting-block" data-state={state}>
      <FieldLegend variant="label">{t("title")}</FieldLegend>
      {state === "off" ? (
        <>
          <FieldDescription>{t("intro")}</FieldDescription>
          <div>
            <Button type="button" variant="outline" disabled={!albumOpen} aria-describedby={albumOpen ? undefined : `${id}-not-yet`} onClick={start}>
              {t("start")}
            </Button>
          </div>
          {!albumOpen && <FieldDescription id={`${id}-not-yet`}>{t("notYet")}</FieldDescription>}
        </>
      ) : (
        <>
          <p className="text-sm">{state === "open" ? t("open") : t("closed")}</p>
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
            <AlertDialog open={confirming} onOpenChange={setConfirming}>
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
                    <AlertDialogDescription>{t("turnOffText", { count: votes })}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="pt-4">
                    <AlertDialogCancel type="button">{t("cancel")}</AlertDialogCancel>
                    <Button type="submit" variant="destructive">
                      {t("turnOffConfirm")}
                    </Button>
                  </AlertDialogFooter>
                </form>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </>
      )}
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
