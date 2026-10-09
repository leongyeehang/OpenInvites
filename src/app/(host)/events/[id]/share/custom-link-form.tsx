"use client";

import { Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { removeCustomLinkAction, setCustomLinkAction, type CustomLinkState } from "@/events/actions";

// The host's own link, beside the random one: the field with the instance's address before it,
// and once one is set, the link with Copy and Remove. A refusal stays under the field.
export function CustomLinkForm({ eventId, prefix, custom, link }: { eventId: string; prefix: string; custom: string | null; link: string | null }) {
  const t = useTranslations("Events.share.customLink");
  const [state, save, saving] = useActionState((previous: CustomLinkState, formData: FormData) => setCustomLinkAction(eventId, previous, formData), undefined);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2_000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <form action={save} className="flex flex-col gap-3">
        <Field data-invalid={state?.error ? true : undefined}>
          <FieldLabel htmlFor="customSlug">{t("label")}</FieldLabel>
          <div className="flex flex-wrap items-center gap-x-1 gap-y-2">
            <span className="break-all font-mono text-sm text-muted-foreground" aria-hidden="true">
              {prefix}
            </span>
            <Input
              id="customSlug"
              name="customSlug"
              defaultValue={state?.typed ?? custom ?? ""}
              key={custom ?? ""}
              autoCapitalize="none"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={state?.error ? true : undefined}
              className="w-full max-w-64 font-mono"
            />
          </div>
          {state?.error && <FieldError>{state.error}</FieldError>}
        </Field>
        <Button type="submit" disabled={saving} className="self-start">
          {t("save")}
        </Button>
      </form>
      {custom && link && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={copy} aria-live="polite">
            {copied ? <Check /> : <Copy />}
            {copied ? t("copied") : t("copy")}
          </Button>
          <form action={removeCustomLinkAction.bind(null, eventId)}>
            <Button type="submit" variant="outline">
              {t("remove")}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
