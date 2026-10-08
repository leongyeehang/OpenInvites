"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { requestSignInLink } from "@/auth/actions";
import { Button } from "@/components/ui/button";
import { FormOutcome } from "@/components/form-outcome";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function SignInLinkForm({ next }: { next: string }) {
  const t = useTranslations("Auth.signIn");
  const [state, action, pending] = useActionState(requestSignInLink, undefined);
  return (
    <form action={action} className="flex flex-col gap-4 border-t pt-4">
      <h2 className="font-medium">{t("linkTitle")}</h2>
      {state?.success ? (
        <p role="status">{state.success}</p>
      ) : (
        <>
          <input type="hidden" name="next" value={next} />
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="link-email">{t("linkEmail")}</FieldLabel>
              <Input id="link-email" name="email" type="email" autoComplete="email" required />
            </Field>
            <FormOutcome state={state} />
            <Button type="submit" variant="outline" disabled={pending}>
              {t("linkSubmit")}
            </Button>
          </FieldGroup>
        </>
      )}
    </form>
  );
}
