"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { resendVerificationEmail } from "@/auth/actions";
import { FormOutcome } from "@/components/form-outcome";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function VerificationBanner({ email }: { email: string }) {
  const t = useTranslations("Auth.banner");
  const [state, action, pending] = useActionState(resendVerificationEmail, undefined);
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-4">
      <Alert>
        <AlertTitle>{t("title")}</AlertTitle>
        <AlertDescription>
          <p>{t("text", { email })}</p>
          <FormOutcome state={state} />
        </AlertDescription>
        <AlertAction>
          <form action={action}>
            <Button type="submit" size="sm" variant="outline" disabled={pending}>
              {t("resend")}
            </Button>
          </form>
        </AlertAction>
      </Alert>
    </div>
  );
}
