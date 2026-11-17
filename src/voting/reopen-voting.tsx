"use client";

import { useTranslations } from "next-intl";
import { useState, type ReactElement } from "react";
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
import { CountText, useFresh } from "./fresh-count";
import { reopenVotingAction, tiebreakVotesAction } from "./host-actions";

// Why Reopen voting did not go through: the album is shut again, a tie-break began since the page
// was drawn (the site refuses a reopen the host was not asked about), or it was refused.
export type ReopenRefusal = "albumNotOpen" | "tiebreak" | "refused";

// Reopen voting (M8 ticket 10), in the Voting block and in the hosts' box above the album, each with
// its own button (`button`, given the press when there is no confirmation) and its own way of
// saving a press (`run`). With no tie-break held it is one press. While any award has held one
// (`tiebreak`, voting.ts tiebreakHeld), reopening ends it and deletes its votes, so it asks first,
// with their number read as the confirmation opens, as Turn off voting does; Reopen it sends the
// press as confirmed, which the site requires (the voting part's review, finding 1).
export function ReopenVoting({
  eventId,
  tiebreak,
  run,
  button,
}: {
  eventId: string;
  tiebreak: boolean;
  run: (action: () => Promise<{ error?: ReopenRefusal }>) => unknown;
  button: (press?: () => void) => ReactElement;
}) {
  const t = useTranslations("Voting.block");
  const [confirming, setConfirming] = useState(false);
  const fresh = useFresh(() => tiebreakVotesAction(eventId));
  if (!tiebreak) return button(() => void run(() => reopenVotingAction(eventId, false)));
  return (
    <AlertDialog
      open={confirming}
      onOpenChange={(open) => {
        setConfirming(open);
        fresh.read(open);
      }}
    >
      <AlertDialogTrigger asChild>{button()}</AlertDialogTrigger>
      <AlertDialogContent>
        <form
          action={async () => {
            await run(() => reopenVotingAction(eventId, true));
            setConfirming(false);
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>{t("reopenTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              <CountText failed={fresh.failed} count={fresh.value} text={(count) => t("reopenText", { count })} />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-4">
            <AlertDialogCancel type="button">{t("cancel")}</AlertDialogCancel>
            <Button type="submit" variant="destructive" disabled={!fresh.ready}>
              {t("reopenConfirm")}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
