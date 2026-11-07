"use client";

import { useTranslations } from "next-intl";
import { useOptimistic, useTransition } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field";
import { setLettersEnabledAction } from "@/invites/actions";

// Personal letters on or off for the event, at the top of the invites page (M6 spec, "Personal
// letters"). It is saved as soon as it changes, and the page is drawn again with the letter fields
// shown or hidden; until then the box shows what the host chose.
export function LettersSwitch({ eventId, on }: { eventId: string; on: boolean }) {
  const t = useTranslations("Invites");
  const [shown, show] = useOptimistic(on);
  const [, startSaving] = useTransition();

  const change = (checked: boolean) =>
    startSaving(async () => {
      show(checked);
      await setLettersEnabledAction(eventId, checked);
    });

  return (
    <Field orientation="horizontal">
      <Checkbox id="letters-enabled" checked={shown} onCheckedChange={(checked) => change(checked === true)} aria-describedby="letters-enabled-hint" />
      <FieldContent>
        <FieldLabel htmlFor="letters-enabled">{t("lettersEnabled")}</FieldLabel>
        <FieldDescription id="letters-enabled-hint">{t("lettersEnabledHint")}</FieldDescription>
      </FieldContent>
    </Field>
  );
}
