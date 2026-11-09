"use client";

import { useTranslations } from "next-intl";
import { useActionState, useId, useRef, useState } from "react";
import { FormOutcome } from "@/components/form-outcome";
import { useFocusKept } from "@/components/use-focus-kept";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { saveLetterAction, type LetterState } from "@/invites/actions";
import { adoptSaved } from "@/lib/adopt-saved";

// The host's letter to one guest, on that guest's row of the invites page while the event has
// personal letters on (M6 spec, "Personal letters"). The text is the field's own state, so a
// refusal leaves it as the host wrote it; once saved, it shows the letter as the server kept it,
// trimmed, unless the host typed on while it saved (M6 final review), and "Letter saved." stands
// only until the host changes it again, and Save keeps the focus (M6 ticket 10). Every row has
// one, so the field and its button are named with the guest's name, which `nameId` marks on the
// row.
export function LetterField({ eventId, inviteId, letter, nameId, maxLetter }: { eventId: string; inviteId: string; letter: string; nameId: string; maxLetter: number }) {
  const t = useTranslations("Invites");
  const id = useId();
  const [text, setText] = useState(letter);
  const [changed, setChanged] = useState(false);
  // The field's text as it is now, and as it was when it was last sent, for the answer to compare.
  const current = useRef(letter);
  const submitted = useRef(letter);
  const [state, save, saving] = useActionState(async (previous: LetterState, formData: FormData) => {
    const outcome = await saveLetterAction(eventId, inviteId, previous, formData);
    if (outcome?.letter !== undefined) {
      // Still "changed" when the host typed on: what they typed is not what was saved.
      const shown = adoptSaved({ current: current.current, submitted: submitted.current, kept: outcome.letter });
      current.current = shown;
      setText(shown);
      setChanged(shown !== outcome.letter);
    }
    return outcome;
  }, undefined);
  const [button, keepFocus] = useFocusKept(saving);

  return (
    <form
      action={save}
      onSubmit={() => {
        submitted.current = current.current;
        keepFocus();
      }}
    >
      <FieldGroup className="gap-3">
        <Field>
          <FieldLabel id={`${id}-label`} htmlFor={`${id}-letter`}>
            {t("letter")}
          </FieldLabel>
          <Textarea
            id={`${id}-letter`}
            name="letter"
            rows={3}
            maxLength={maxLetter}
            aria-labelledby={`${id}-label ${nameId}`}
            value={text}
            onChange={(typed) => {
              current.current = typed.target.value;
              setText(typed.target.value);
              setChanged(true);
            }}
          />
        </Field>
        <FormOutcome state={changed && state?.success ? undefined : state} />
        <Button ref={button} id={`${id}-save`} type="submit" variant="outline" size="sm" disabled={saving} aria-labelledby={`${id}-save ${nameId}`} className="self-start">
          {t("saveLetter")}
        </Button>
      </FieldGroup>
    </form>
  );
}
