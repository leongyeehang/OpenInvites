"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { signUp } from "@/auth/actions";
import { Button } from "@/components/ui/button";
import { FormOutcome } from "@/components/form-outcome";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

// A host invitation addressed to someone fills in their email, which they may still change.
export function SignUpForm({ email }: { email?: string }) {
  const t = useTranslations("Auth.signUp");
  const [state, action, pending] = useActionState(signUp, undefined);
  return (
    <form action={action}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="name">{t("displayName")}</FieldLabel>
          <Input id="name" name="name" autoComplete="nickname" required maxLength={80} />
          <FieldDescription>{t("displayNameHint")}</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="email">{t("email")}</FieldLabel>
          <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={email} />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">{t("password")}</FieldLabel>
          <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
          <FieldDescription>{t("passwordHint")}</FieldDescription>
        </Field>
        <FormOutcome state={state} />
        <Button type="submit" disabled={pending}>
          {t("submit")}
        </Button>
      </FieldGroup>
    </form>
  );
}
