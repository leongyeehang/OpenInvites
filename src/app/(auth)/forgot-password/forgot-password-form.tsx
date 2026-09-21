"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { requestPasswordReset } from "@/auth/actions";
import { Button } from "@/components/ui/button";
import { FormOutcome } from "@/components/form-outcome";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function ForgotPasswordForm() {
  const t = useTranslations("Auth.forgotPassword");
  const [state, action, pending] = useActionState(requestPasswordReset, undefined);
  if (state?.success) {
    return <p role="status">{state.success}</p>;
  }
  return (
    <form action={action}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="email">{t("email")}</FieldLabel>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <FormOutcome state={state} />
        <Button type="submit" disabled={pending}>
          {t("submit")}
        </Button>
        <FieldDescription className="sr-only">{t("description")}</FieldDescription>
      </FieldGroup>
    </form>
  );
}
