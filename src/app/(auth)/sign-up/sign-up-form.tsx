"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { signUp } from "@/auth/actions";
import { Button } from "@/components/ui/button";
import { FormOutcome } from "@/components/form-outcome";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { FormState } from "@/lib/form-state";
import { Turnstile } from "@/turnstile/turnstile";

// A host invitation addressed to someone fills in their email, which they may still change. With
// Turnstile on, Create account waits for its check, and each sign-up sent spends the token.
export function SignUpForm({ email, turnstileSiteKey }: { email?: string; turnstileSiteKey?: string }) {
  const t = useTranslations("Auth.signUp");
  const [checkPassed, setCheckPassed] = useState(false);
  const [state, action, pending] = useActionState((previous: FormState, formData: FormData) => {
    setCheckPassed(false);
    return signUp(previous, formData);
  }, undefined);
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
        {turnstileSiteKey && <Turnstile siteKey={turnstileSiteKey} onToken={setCheckPassed} resets={state} />}
        <FormOutcome state={state} />
        <Button type="submit" disabled={pending || (turnstileSiteKey !== undefined && !checkPassed)}>
          {t("submit")}
        </Button>
      </FieldGroup>
    </form>
  );
}
