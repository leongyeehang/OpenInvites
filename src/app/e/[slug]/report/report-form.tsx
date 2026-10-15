"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { sendReportAction, type ReportState } from "@/reports/actions";
import { Turnstile } from "@/turnstile/turnstile";

// What the reporter has to say, and an email to reach them by if they like. A refusal leaves what
// they typed as it was, with the reason under the field it belongs to; once sent, the form is
// replaced by the thanks and the way back to the page. With Turnstile on, Send report waits for its
// check, and each report sent spends the token.
export function ReportForm({ slug, eventPath, turnstileSiteKey }: { slug: string; eventPath: string; turnstileSiteKey?: string }) {
  const t = useTranslations("Report");
  const [checkPassed, setCheckPassed] = useState(false);
  const [state, send, sending] = useActionState((previous: ReportState, formData: FormData) => {
    setCheckPassed(false);
    return sendReportAction(slug, previous, formData);
  }, undefined);

  if (state?.sent) {
    return (
      <div className="flex flex-col gap-4">
        <p role="status">{t("thanks")}</p>
        <Link href={eventPath} className="text-sm underline underline-offset-4">
          {t("back")}
        </Link>
      </div>
    );
  }
  const error = state?.error;
  const aboutReason = error === "reasonTooShort" || error === "reasonTooLong";
  return (
    <form action={send}>
      <FieldGroup>
        <Field data-invalid={aboutReason || undefined}>
          <FieldLabel htmlFor="reason">{t("reason")}</FieldLabel>
          <Textarea id="reason" name="reason" rows={5} required defaultValue={state?.reason} aria-invalid={aboutReason || undefined} />
          {aboutReason && <FieldError>{t(`errors.${error}`)}</FieldError>}
        </Field>
        <Field data-invalid={error === "contactInvalid" || undefined}>
          <FieldLabel htmlFor="contact">{t("contact")}</FieldLabel>
          <Input id="contact" name="contact" type="email" autoComplete="email" defaultValue={state?.contact} aria-invalid={error === "contactInvalid" || undefined} />
          <FieldDescription>{t("contactHint")}</FieldDescription>
          {error === "contactInvalid" && <FieldError>{t("errors.contactInvalid")}</FieldError>}
        </Field>
        {turnstileSiteKey && <Turnstile siteKey={turnstileSiteKey} onToken={setCheckPassed} resets={state} />}
        {(error === "closed" || error === "tooFast" || error === "checkFailed") && <FieldError>{t(`errors.${error}`)}</FieldError>}
        <Button type="submit" disabled={sending || (turnstileSiteKey !== undefined && !checkPassed)}>
          {t("submit")}
        </Button>
      </FieldGroup>
    </form>
  );
}
