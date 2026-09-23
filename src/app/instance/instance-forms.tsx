"use client";

import { Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { FormOutcome } from "@/components/form-outcome";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createHostInvitationAction, setRegistrationModeAction } from "@/instance/actions";
import { REGISTRATION_MODES, type RegistrationMode } from "@/instance/registration";

export function RegistrationForm({ mode }: { mode: RegistrationMode }) {
  const t = useTranslations("Instance.registration");
  const [state, action, pending] = useActionState(setRegistrationModeAction, undefined);
  return (
    <form action={action}>
      <FieldGroup>
        <FieldSet>
          <FieldLegend className="sr-only">{t("title")}</FieldLegend>
          {REGISTRATION_MODES.map((value) => (
            <Field key={value} orientation="horizontal">
              <input
                type="radio"
                id={`mode-${value}`}
                name="mode"
                value={value}
                defaultChecked={mode === value}
                className="mt-0.5 size-4 shrink-0 accent-primary"
              />
              <FieldContent>
                <FieldLabel htmlFor={`mode-${value}`}>{t(value)}</FieldLabel>
                <FieldDescription>{t(`${value}Hint`)}</FieldDescription>
              </FieldContent>
            </Field>
          ))}
        </FieldSet>
        <FormOutcome state={state} />
        <Button type="submit" disabled={pending} className="self-start">
          {t("submit")}
        </Button>
      </FieldGroup>
    </form>
  );
}

// Without mail there is no way to send the link from here, so the box to do so is not offered.
export function HostInvitationForm({ canSend }: { canSend: boolean }) {
  const t = useTranslations("Instance.invitations");
  const [state, action, pending] = useActionState(createHostInvitationAction, undefined);
  return (
    <div className="flex flex-col gap-4">
      <form action={action}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="invitation-email">{t("email")}</FieldLabel>
            <Input id="invitation-email" name="email" type="email" autoComplete="off" />
            <FieldDescription>{t("emailHint")}</FieldDescription>
          </Field>
          {canSend && (
            <Field orientation="horizontal">
              <Checkbox id="invitation-send" name="send" />
              <FieldLabel htmlFor="invitation-send">{t("send")}</FieldLabel>
            </Field>
          )}
          {!state?.link && state?.error && <FieldError>{state.error}</FieldError>}
          <Button type="submit" disabled={pending} className="self-start">
            {t("submit")}
          </Button>
        </FieldGroup>
      </form>
      {state?.link && <NewHostInvitation link={state.link} sentTo={state.sentTo} notSent={state.error} />}
    </div>
  );
}

function NewHostInvitation({ link, sentTo, notSent }: { link: string; sentTo?: string; notSent?: string }) {
  const t = useTranslations("Instance.invitations");
  const [copied, setCopied] = useState(false);

  // As on the share page: a browser that refuses the clipboard leaves the link on the page to
  // select by hand, and "Copied" is said for a moment rather than forever.
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2_000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-muted/50 p-4">
      <p role="status" className="text-sm">
        {t("created")}
      </p>
      <Field>
        <FieldLabel htmlFor="invitation-link">{t("link")}</FieldLabel>
        <Input id="invitation-link" readOnly value={link} onFocus={(event) => event.currentTarget.select()} className="font-mono" />
      </Field>
      <Button type="button" onClick={copy} className="self-start" aria-live="polite">
        {copied ? <Check /> : <Copy />}
        {copied ? t("copied") : t("copy")}
      </Button>
      {sentTo && (
        <p role="status" className="text-sm">
          {t("sent", { email: sentTo })}
        </p>
      )}
      {notSent && <FieldError>{notSent}</FieldError>}
    </div>
  );
}
