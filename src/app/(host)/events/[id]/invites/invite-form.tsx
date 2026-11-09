"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { FormOutcome } from "@/components/form-outcome";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createInviteAction, createInvitesAction } from "@/invites/actions";
import type { FormState } from "@/lib/form-state";

// One personal invite at a time: the guest's name and, if the host has them, their email and phone,
// and, when the event has personal letters on, the host's letter to them (M6 spec, "The invite
// list"). The fields are the form's own state, so a refusal leaves them as they were; once the link
// is made they start again, and the new invite heads the list below.
export function InviteForm({ eventId, letters, maxLetter }: { eventId: string; letters: boolean; maxLetter: number }) {
  const t = useTranslations("Invites");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [letter, setLetter] = useState("");
  const [state, make, making] = useActionState(async (previous: FormState, formData: FormData) => {
    const outcome = await createInviteAction(eventId, previous, formData);
    if (outcome?.success) {
      setName("");
      setEmail("");
      setPhone("");
      setLetter("");
    }
    return outcome;
  }, undefined);

  return (
    <form action={make}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="invite-name">{t("name")}</FieldLabel>
          <Input id="invite-name" name="name" autoComplete="off" required value={name} onChange={(typed) => setName(typed.target.value)} />
        </Field>
        <Field>
          <FieldLabel htmlFor="invite-email">{t("email")}</FieldLabel>
          {/* Not type="email", as on the RSVP form: the action checks the address and says what is
              wrong with it in the host's language. */}
          <Input
            id="invite-email"
            name="email"
            inputMode="email"
            autoComplete="off"
            aria-describedby="invite-email-hint"
            value={email}
            onChange={(typed) => setEmail(typed.target.value)}
          />
          <FieldDescription id="invite-email-hint">{t("emailHint")}</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="invite-phone">{t("phone")}</FieldLabel>
          {/* Not type="tel" either, for the same reason; the keypad is still the phone's. */}
          <Input
            id="invite-phone"
            name="phone"
            inputMode="tel"
            autoComplete="off"
            aria-describedby="invite-phone-hint"
            value={phone}
            onChange={(typed) => setPhone(typed.target.value)}
          />
          <FieldDescription id="invite-phone-hint">{t("phoneHint")}</FieldDescription>
        </Field>
        {letters && (
          <Field>
            <FieldLabel htmlFor="invite-letter">{t("letter")}</FieldLabel>
            <Textarea
              id="invite-letter"
              name="letter"
              rows={4}
              maxLength={maxLetter}
              aria-describedby="invite-letter-hint"
              value={letter}
              onChange={(typed) => setLetter(typed.target.value)}
            />
            <FieldDescription id="invite-letter-hint">{t("letterHint")}</FieldDescription>
          </Field>
        )}
        <FormOutcome state={state} />
        <Button type="submit" disabled={making} className="self-start">
          {t("make")}
        </Button>
      </FieldGroup>
    </form>
  );
}

// "Add several": one person per line, as `Name, email, phone` (M6 spec, "The invite list"). All of
// them are made, or, when a line is wrong, none, and the line is named; the text stays for the host
// to correct, and is cleared once the links are made.
export function PasteInvites({ eventId }: { eventId: string }) {
  const t = useTranslations("Invites");
  const [people, setPeople] = useState("");
  const [state, make, making] = useActionState(async (previous: FormState, formData: FormData) => {
    const outcome = await createInvitesAction(eventId, previous, formData);
    if (outcome?.success) setPeople("");
    return outcome;
  }, undefined);

  return (
    <form action={make}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="invite-people">{t("paste")}</FieldLabel>
          <Textarea
            id="invite-people"
            name="people"
            rows={4}
            required
            autoComplete="off"
            spellCheck={false}
            aria-describedby="invite-people-hint"
            value={people}
            onChange={(typed) => setPeople(typed.target.value)}
          />
          <FieldDescription id="invite-people-hint">{t("pasteHint")}</FieldDescription>
        </Field>
        <FormOutcome state={state} />
        <Button type="submit" variant="outline" disabled={making} className="self-start">
          {t("pasteMake")}
        </Button>
      </FieldGroup>
    </form>
  );
}
