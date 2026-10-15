"use client";

import { Check } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useActionState, useState, useTransition } from "react";
import { DeleteDialogContent } from "@/components/delete-dialog-content";
import { FormOutcome } from "@/components/form-outcome";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { FormState } from "@/lib/form-state";
import { approveGuestAction, declineGuestAction, editGuestAction, moveToGoingAction, removeGuestAction } from "@/rsvps/actions";
import { chosenStatus, RSVP_STATUSES } from "@/rsvps/form";
import type { GuestAnswer } from "@/questions/repository";
import type { HostGuest } from "@/rsvps/repository";

// One guest on the host's list: who they are and what they answered, and, when the host opens
// it, the form that changes it on their behalf. A guest on the waitlist is shown with their place
// in it and their party as "+N", and can be moved to Going. A reply waiting for the host's
// approval says what it answered and can be approved or declined; a declined one can be approved.
export function GuestRow({
  eventId,
  guest,
  position,
  replied,
  changed,
  answers,
  savedAt,
  plusOnesAllowed,
}: {
  eventId: string;
  guest: HostGuest;
  // The guest's place on the waitlist, when they are on it.
  position?: number;
  replied: string;
  changed?: string;
  answers: GuestAnswer[];
  savedAt: string;
  plusOnesAllowed: number;
}) {
  const t = useTranslations("Guests");
  const format = useFormatter();
  const [open, setOpen] = useState(false);
  const [state, save, saving] = useActionState(editGuestAction.bind(null, eventId, guest.id), undefined);
  const named = guest.plusOneNames.filter(Boolean);

  return (
    <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <p className="font-medium">
            {/* The list numbers itself for a screen reader (page.tsx); the number is for the eye. */}
            {position !== undefined && (
              <span aria-hidden className="mr-1.5 text-muted-foreground tabular-nums">
                {position}.
              </span>
            )}
            {guest.name}
            {position !== undefined && guest.plusOnes > 0 && <span className="ml-1.5 text-muted-foreground">+{guest.plusOnes}</span>}
          </p>
          <p className="text-sm text-muted-foreground">
            {/* The section says what an approved reply answered; one the host has yet to approve, or
                declined, says it here. */}
            {guest.approval !== "approved" && <span>{t(`group.${guest.status}`)} · </span>}
            {guest.plusOnes > 0 && position === undefined && <span>{t("plusOnes", { count: guest.plusOnes })} · </span>}
            <span>{t("replied", { when: replied })}</span>
            {changed && <span> · {t("changed", { when: changed })}</span>}
          </p>
          {named.length > 0 && <p className="text-sm text-muted-foreground">{t("bringing", { names: format.list(named) })}</p>}
          {guest.mailStoppedAt ? (
            <p className="text-sm text-muted-foreground">{t("row.mailStopped")}</p>
          ) : (
            guest.email && (
              <p className="text-sm break-all text-muted-foreground">
                <span>{guest.email}</span>
                {/* Beside an address the guest proved with a code (spec, story 156). */}
                {guest.emailVerifiedAt && (
                  <>
                    <Check aria-hidden className="ml-1 inline size-3.5 align-[-2px] text-foreground" />
                    <span className="sr-only"> {t("row.emailChecked")}</span>
                  </>
                )}
              </p>
            )
          )}
          {guest.phone && <p className="text-sm break-all text-muted-foreground">{guest.phone}</p>}
          {answers.length > 0 && (
            <dl className="mt-2 flex flex-col gap-1 text-sm">
              {answers.map((given) => (
                <div key={given.questionId} className="flex flex-wrap gap-x-2">
                  <dt className="text-muted-foreground">{given.prompt}</dt>
                  <dd className="font-medium">{format.list(given.values, { type: "conjunction" })}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {guest.status === "waitlisted" && <MoveToGoing eventId={eventId} guestId={guest.id} />}
          {guest.approval !== "approved" && <Decide eventId={eventId} guestId={guest.id} declinable={guest.approval === "pending"} />}
          <Button variant="ghost" size="sm" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? t("close") : t("edit")}
          </Button>
        </div>
      </div>

      {open && (
        // Rebuilt whenever the stored answer changes: React empties a form once its action has
        // run, so fields that outlived a save would post stale values on the next one.
        <EditGuest
          key={savedAt}
          eventId={eventId}
          guest={guest}
          plusOnesAllowed={plusOnesAllowed}
          action={save}
          state={state}
          saving={saving}
        />
      )}
    </div>
  );
}

function EditGuest({
  eventId,
  guest,
  plusOnesAllowed,
  action,
  state,
  saving,
}: {
  eventId: string;
  guest: HostGuest;
  plusOnesAllowed: number;
  action: (formData: FormData) => void;
  state: FormState;
  saving: boolean;
}) {
  const t = useTranslations("Guests");
  const [plusOnes, setPlusOnes] = useState(guest.plusOnes);

  return (
    <form action={action} className="mt-4 border-t pt-4">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`name-${guest.id}`}>{t("nameLabel")}</FieldLabel>
          <Input id={`name-${guest.id}`} name="name" defaultValue={guest.name} required />
        </Field>
        <Field>
          <FieldLabel htmlFor={`status-${guest.id}`}>{t("status")}</FieldLabel>
          {/* The three a guest chooses from; a guest on the waitlist asked for Going, and saving
              it keeps them waiting (rsvps/admission.ts, hostStatus). */}
          <NativeSelect id={`status-${guest.id}`} name="status" defaultValue={chosenStatus(guest.status)}>
            {RSVP_STATUSES.map((status) => (
              <NativeSelectOption key={status} value={status}>
                {t(`group.${status}`)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor={`plus-ones-${guest.id}`}>{t("plusOnesLabel")}</FieldLabel>
          <NativeSelect
            id={`plus-ones-${guest.id}`}
            name="plusOnes"
            value={String(plusOnes)}
            onChange={(picked) => setPlusOnes(Number(picked.target.value))}
          >
            {Array.from({ length: plusOnesAllowed + 1 }, (_, allowed) => (
              <NativeSelectOption key={allowed} value={String(allowed)}>
                {allowed}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        {Array.from({ length: plusOnes }, (_, index) => (
          <Field key={index}>
            <FieldLabel htmlFor={`plus-one-${guest.id}-${index}`}>{t("guestName", { number: index + 1 })}</FieldLabel>
            <Input id={`plus-one-${guest.id}-${index}`} name="plusOneNames" defaultValue={guest.plusOneNames[index] ?? ""} />
          </Field>
        ))}
        {/* Both, whatever the guests are asked: the host may know them from elsewhere, and a field
            left out of the form would blank what is stored. Not the email of a guest who stopped
            email about the event, which only they can give again (the action ignores one posted).
            Not type="email": an address the browser doubts but the guest gave would block every
            save; the action checks it. */}
        {!guest.mailStoppedAt && (
          <Field>
            <FieldLabel htmlFor={`email-${guest.id}`}>{t("emailLabel")}</FieldLabel>
            <Input id={`email-${guest.id}`} name="email" inputMode="email" autoComplete="off" defaultValue={guest.email ?? ""} />
          </Field>
        )}
        <Field>
          <FieldLabel htmlFor={`phone-${guest.id}`}>{t("phoneLabel")}</FieldLabel>
          <Input id={`phone-${guest.id}`} name="phone" type="tel" autoComplete="off" defaultValue={guest.phone ?? ""} />
        </Field>
        <FormOutcome state={state} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button type="submit" disabled={saving}>
            {t("save")}
          </Button>
          <RemoveGuest eventId={eventId} guest={guest} />
        </div>
      </FieldGroup>
    </form>
  );
}

// Going at once, whatever the capacity (spec, story 145). The row moves to Going and this button
// goes with it, so the focus goes to the page's heading, as after a removal.
function MoveToGoing({ eventId, guestId }: { eventId: string; guestId: string }) {
  const t = useTranslations("Guests");
  const [moving, startMoving] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={moving}
      onClick={() =>
        startMoving(async () => {
          await moveToGoingAction(eventId, guestId);
          document.getElementById("guest-list-heading")?.focus();
        })
      }
    >
      {t("moveToGoing")}
    </Button>
  );
}

// The host's word on a reply they have not approved (spec, "Approval"): Approve, and Decline while
// it waits for them. Either moves the row to another section and takes these buttons with it, so
// the focus goes to the page's heading, as after Move to Going.
function Decide({ eventId, guestId, declinable }: { eventId: string; guestId: string; declinable: boolean }) {
  const t = useTranslations("Guests");
  const [deciding, startDeciding] = useTransition();
  const decide = (action: (eventId: string, rsvpId: string) => Promise<void>) =>
    startDeciding(async () => {
      await action(eventId, guestId);
      document.getElementById("guest-list-heading")?.focus();
    });
  return (
    <>
      <Button variant="outline" size="sm" disabled={deciding} onClick={() => decide(approveGuestAction)}>
        {t("approve")}
      </Button>
      {declinable && (
        <Button variant="outline" size="sm" disabled={deciding} onClick={() => decide(declineGuestAction)}>
          {t("decline")}
        </Button>
      )}
    </>
  );
}

// Removing a guest cannot be undone and takes their edit link with it, so it is confirmed, the
// way deleting an account is. The dialog's own form is portalled out of the edit form above. Once
// the guest is gone, with this button, the focus goes to the page's heading (page.tsx).
function RemoveGuest({ eventId, guest }: { eventId: string; guest: HostGuest }) {
  const t = useTranslations("Guests");
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="destructive">
          {t("remove")}
        </Button>
      </AlertDialogTrigger>
      <DeleteDialogContent focusAfter="guest-list-heading">
        <form action={removeGuestAction.bind(null, eventId, guest.id)}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("removeTitle", { name: guest.name })}</AlertDialogTitle>
            <AlertDialogDescription>{t("removeText")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-4">
            <AlertDialogCancel type="button">{t("cancel")}</AlertDialogCancel>
            <Button type="submit" variant="destructive">
              {t("confirmRemove")}
            </Button>
          </AlertDialogFooter>
        </form>
      </DeleteDialogContent>
    </AlertDialog>
  );
}
