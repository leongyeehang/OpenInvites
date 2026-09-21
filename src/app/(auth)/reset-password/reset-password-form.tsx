"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { resetPassword } from "@/auth/actions";
import { Button } from "@/components/ui/button";
import { FormOutcome } from "@/components/form-outcome";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations("Auth.resetPassword");
  const [state, action, pending] = useActionState(resetPassword, undefined);
  return (
    <form action={action}>
      <input type="hidden" name="token" value={token} />
      <FieldGroup>
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
