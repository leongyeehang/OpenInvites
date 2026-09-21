"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { signIn } from "@/auth/actions";
import { Button } from "@/components/ui/button";
import { FormOutcome } from "@/components/form-outcome";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function SignInForm() {
  const t = useTranslations("Auth.signIn");
  const [state, action, pending] = useActionState(signIn, undefined);
  return (
    <form action={action}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="email">{t("email")}</FieldLabel>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">{t("password")}</FieldLabel>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </Field>
        <FormOutcome state={state} />
        <Button type="submit" disabled={pending}>
          {t("submit")}
        </Button>
      </FieldGroup>
    </form>
  );
}
