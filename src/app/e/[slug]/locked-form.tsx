"use client";

import { useTranslations } from "next-intl";
import { startTransition, useActionState, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { passAction, type PassState } from "@/invites/pass-actions";

// The locked page's way in (invites/pass-actions.ts): the email, "Send me a code", then the code
// and "Send it again", which waits thirty seconds after each code, counting them down, as the RSVP
// form's code step does. The answer to "Send me a code" is the same whether or not the email is on
// the invite list. A right code gives this device a pass, and the page is drawn again as the
// invitation. Changing the email goes back to asking for a code.
export function LockedForm({ slug, email: given }: { slug: string; email: string | null }) {
  const t = useTranslations("InviteOnly");
  const id = useId();
  const [email, setEmail] = useState(given ?? "");
  const [code, setCode] = useState("");
  // The address the last code was asked for, and the seconds until another may be.
  const [sentTo, setSentTo] = useState<string>();
  const [resendIn, setResendIn] = useState(0);
  const codeField = useRef<HTMLInputElement>(null);
  const [state, send, sending] = useActionState(async (previous: PassState, formData: FormData) => {
    const answer = await passAction(slug, previous, formData);
    if (answer?.sent) {
      setSentTo(answer.sent.email);
      setResendIn(answer.sent.resendIn);
    }
    return answer;
  }, undefined);
  const codeStep = sentTo !== undefined && sentTo === email.trim();

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((left) => left - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);
  // A code on its way puts the focus on its field.
  useEffect(() => {
    if (codeStep) codeField.current?.focus();
  }, [codeStep, sentTo]);

  // "Send it again" posts the email alone, which asks for another code.
  const resend = () => {
    if (sending || resendIn > 0) return;
    const data = new FormData();
    data.set("email", email);
    setCode("");
    startTransition(() => send(data));
  };

  const error = state?.error;
  return (
    <form action={send}>
      <FieldGroup>
        <Field data-invalid={error === "emailInvalid" || undefined}>
          <FieldLabel htmlFor={`${id}-email`}>{t("email")}</FieldLabel>
          <Input
            id={`${id}-email`}
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(typed) => setEmail(typed.target.value)}
            readOnly={given !== null}
            aria-describedby={`${id}-email-hint`}
            aria-invalid={error === "emailInvalid" || undefined}
          />
          <FieldDescription id={`${id}-email-hint`}>{t("emailHint")}</FieldDescription>
        </Field>
      </FieldGroup>

      {/* What asking did, said as it comes: on the page from the first, empty, so it is heard. */}
      <p role="status" className={codeStep ? "mt-5 text-sm break-words" : undefined}>
        {codeStep ? t("sent") : ""}
      </p>

      <FieldGroup className="mt-5">
        {codeStep && (
          <Field data-invalid={error === "codeWrong" || error === "codeExpired" || undefined}>
            <FieldLabel htmlFor={`${id}-code`}>{t("code")}</FieldLabel>
            <Input
              ref={codeField}
              id={`${id}-code`}
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(typed) => setCode(typed.target.value)}
              aria-invalid={error === "codeWrong" || error === "codeExpired" || undefined}
            />
          </Field>
        )}

        {error && <FieldError>{t(`errors.${error}`)}</FieldError>}

        {codeStep ? (
          <div className="flex flex-col gap-3">
            <Button type="submit" disabled={sending || !code.trim()}>
              {t("open")}
            </Button>
            {/* While it waits the button stays in the tab order, `aria-disabled` and a no-op, under
                the name it always has; the seconds it shows are its description. */}
            <button
              type="button"
              onClick={resend}
              aria-disabled={sending || resendIn > 0}
              aria-label={t("resend")}
              aria-describedby={resendIn > 0 ? `${id}-resend-in` : undefined}
              className="cursor-pointer self-start text-sm underline underline-offset-2 hover:opacity-80 aria-disabled:cursor-default aria-disabled:no-underline aria-disabled:opacity-70"
            >
              <span id={`${id}-resend-in`}>{resendIn > 0 ? t("resendIn", { seconds: resendIn }) : t("resend")}</span>
            </button>
          </div>
        ) : (
          <Button type="submit" disabled={sending}>
            {t("send")}
          </Button>
        )}
      </FieldGroup>
    </form>
  );
}
