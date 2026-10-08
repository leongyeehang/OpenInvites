"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useActionState, useState } from "react";
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
import { editGuestAction, removeGuestAction } from "@/rsvps/actions";
import { RSVP_STATUSES } from "@/rsvps/form";
import type { GuestAnswer } from "@/questions/repository";
import type { HostGuest } from "@/rsvps/repository";

// One guest on the host's list: who they are and what they answered, and, when the host opens
// it, the form that changes it on their behalf.
export function GuestRow({
  eventId,
  guest,
  replied,
  changed,
  answers,
  savedAt,
  plusOnesAllowed,
}: {
  eventId: string;
  guest: HostGuest;
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
          <p className="font-medium">{guest.name}</p>
          <p className="text-sm text-muted-foreground">
            {guest.plusOnes > 0 && <span>{t("plusOnes", { count: guest.plusOnes })} · </span>}
            <span>{t("replied", { when: replied })}</span>
            {changed && <span> · {t("changed", { when: changed })}</span>}
          </p>
          {named.length > 0 && <p className="text-sm text-muted-foreground">{t("bringing", { names: format.list(named) })}</p>}
          {guest.email && <p className="text-sm break-all text-muted-foreground">{guest.email}</p>}
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
        <Button variant="ghost" size="sm" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? t("close") : t("edit")}
        </Button>
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
          <NativeSelect id={`status-${guest.id}`} name="status" defaultValue={guest.status}>
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
