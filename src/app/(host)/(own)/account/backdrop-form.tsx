"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { FormOutcome } from "@/components/form-outcome";
import { Button } from "@/components/ui/button";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { setHostLookAction } from "@/hosts/actions";
import { PosterChoices } from "@/themes/poster-choices";
import type { GalleryPosterId } from "@/themes/posters";

// The Backdrop card (M8 ticket 22): Automatic, or one gallery poster from its card picture drawn
// large, all one radio group. Chosen, then saved with Save, so that someone moving through twenty
// posters with the arrow keys posts once; saved, the frame round the page wears it at once.
export function BackdropForm({ pick }: { pick: GalleryPosterId | null }) {
  const t = useTranslations("Account.backdrop");
  const [state, action, pending] = useActionState(setHostLookAction, undefined);
  const [chosen, setChosen] = useState<GalleryPosterId | null>(pick);
  return (
    <form action={action}>
      <FieldGroup>
        <FieldSet>
          <FieldLegend className="sr-only">{t("title")}</FieldLegend>
          <Field orientation="horizontal">
            <input
              type="radio"
              id="backdrop-auto"
              name="poster"
              value="auto"
              checked={chosen === null}
              onChange={() => setChosen(null)}
              className="mt-0.5 size-4 shrink-0 accent-primary"
            />
            <FieldContent>
              <FieldLabel htmlFor="backdrop-auto">{t("automatic")}</FieldLabel>
              <FieldDescription>{t("automaticHint")}</FieldDescription>
            </FieldContent>
          </Field>
          <PosterChoices mode="one" ids={chosen ? [chosen] : []} onToggle={setChosen} onPick={setChosen} name="poster" idPrefix="backdrop" size="large" />
        </FieldSet>
        <FormOutcome state={state} />
        <Button type="submit" disabled={pending} className="self-start">
          {t("submit")}
        </Button>
      </FieldGroup>
    </form>
  );
}
