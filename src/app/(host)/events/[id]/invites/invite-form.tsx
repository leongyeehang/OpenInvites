"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { FormOutcome } from "@/components/form-outcome";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createInviteAction } from "@/invites/actions";
import type { FormState } from "@/lib/form-state";

// One personal invite at a time: the guest's name and, if the host has it, their email. The fields
// are the form's own state, so a refusal leaves them as they were; once the link is made they start
// again, and the new invite heads the list below.
export function InviteForm({ eventId }: { eventId: string }) {
  const t = useTranslations("Invites");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [state, make, making] = useActionState(async (previous: FormState, formData: FormData) => {
    const outcome = await createInviteAction(eventId, previous, formData);
    if (outcome?.success) {
      setName("");
      setEmail("");
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
        <FormOutcome state={state} />
        <Button type="submit" disabled={making} className="self-start">
          {t("make")}
        </Button>
      </FieldGroup>
    </form>
  );
}
