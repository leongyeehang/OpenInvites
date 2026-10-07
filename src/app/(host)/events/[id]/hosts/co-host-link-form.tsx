"use client";

import { Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createCoHostLinkAction } from "@/hosts/actions";

// "Make a co-host link", and the link it made, shown this once with Copy, as the instance settings
// show a host invitation.
export function CoHostLinkForm({ eventId, days }: { eventId: string; days: number }) {
  const t = useTranslations("Hosts");
  const [state, action, pending] = useActionState(createCoHostLinkAction.bind(null, eventId), undefined);
  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="flex flex-col gap-3">
        {state?.error && <FieldError>{state.error}</FieldError>}
        <Button type="submit" disabled={pending} className="self-start">
          {t("make")}
        </Button>
      </form>
      {state?.link && <NewCoHostLink link={state.link} days={days} />}
    </div>
  );
}

function NewCoHostLink({ link, days }: { link: string; days: number }) {
  const t = useTranslations("Hosts");
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
        {t("created", { days })}
      </p>
      <Field>
        <FieldLabel htmlFor="co-host-link">{t("link")}</FieldLabel>
        <Input id="co-host-link" readOnly value={link} onFocus={(event) => event.currentTarget.select()} className="font-mono" />
      </Field>
      <Button type="button" onClick={copy} className="self-start" aria-live="polite">
        {copied ? <Check /> : <Copy />}
        {copied ? t("copied") : t("copy")}
      </Button>
    </div>
  );
}
