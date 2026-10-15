"use client";

import { Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { setCustomLinkAction, type CustomLinkState } from "@/events/actions";

// The host's own link, beside the random one: the field with the instance's address before it,
// and once one is set, the link with Copy and Remove. A refusal stays under the field.
export function CustomLinkForm({ eventId, prefix, custom, link, randomLink }: { eventId: string; prefix: string; custom: string | null; link: string | null; randomLink: string }) {
  const t = useTranslations("Events.share.customLink");
  const [state, save, saving] = useActionState((previous: CustomLinkState, formData: FormData) => setCustomLinkAction(eventId, previous, formData), undefined);
  const [copied, setCopied] = useState<"custom" | "random" | null>(null);

  const copy = async (which: "custom" | "random", text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 2_000);
    } catch {
      setCopied(null);
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
        {state?.success && <p role="status" className="text-sm text-muted-foreground">{state.success}</p>}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={saving}>
            {t("save")}
          </Button>
          {custom && link && (
            <>
              <Button type="button" variant="outline" onClick={() => copy("custom", link)} aria-live="polite">
                {copied === "custom" ? <Check /> : <Copy />}
                {copied === "custom" ? t("copied") : t("copy")}
              </Button>
              <Button type="submit" name="remove" value="1" variant="outline" disabled={saving}>
                {t("remove")}
              </Button>
            </>
          )}
        </div>
      </form>
      {custom && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">{t("randomStillWorks")}</p>
          <p className="break-all font-mono text-sm">{randomLink}</p>
          <Button type="button" variant="outline" className="self-start" onClick={() => copy("random", randomLink)} aria-live="polite">
            {copied === "random" ? <Check /> : <Copy />}
            {copied === "random" ? t("copied") : t("copyRandom")}
          </Button>
        </div>
      )}
    </div>
  );
}
