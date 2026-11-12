"use client";

import { useTranslations } from "next-intl";
import { startTransition, useActionState, useState } from "react";
import { postAnnouncementAction } from "@/announcements/actions";
import { DEFAULT_AUDIENCE, MAX_BODY } from "@/announcements/announcement";
import { FormOutcome } from "@/components/form-outcome";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import type { FormState } from "@/lib/form-state";
import { SAVED_STATUSES, type SavedStatus } from "@/rsvps/form";

// What the host says, and which guests are emailed it, by status, the waitlist among them
// (unticked at first). "Send a reminder now" fills in a reminder, already written in the host's
// language, which they may change and send like any other announcement. A draft the page was
// opened with (`?draft=`, M8 ticket 14) is where the message and its audience start. The fields are
// the form's own state, so a refusal leaves them as they were; once the announcement is posted they
// start again, empty, with the usual audience. Without mail the boxes are shown but cannot change.
//
// The form is sent from its submit event, not through its `action`: React resets a form after an
// action passed that way, sent or refused, and each checkbox (Radix) answers the reset by setting
// itself back to the value it was first drawn with, the draft's, which raced the audience set here
// and undid a refusal's (flake fix, M8 ticket 14).
export function AnnouncementForm({
  eventId,
  reminder,
  mail,
  draft,
}: {
  eventId: string;
  reminder: string;
  mail: boolean;
  draft?: { body: string; audience?: readonly SavedStatus[] };
}) {
  const t = useTranslations("Announcements");
  const [body, setBody] = useState(draft?.body ?? "");
  const [audience, setAudience] = useState<readonly SavedStatus[]>(draft?.audience ?? DEFAULT_AUDIENCE);
  const [state, send, sending] = useActionState(async (previous: FormState, formData: FormData) => {
    const outcome = await postAnnouncementAction(eventId, previous, formData);
    // Within the action's transition, so the fields start again as the posted announcement shows
    // (Next.js guide, "interactive apps": updates after an await leave the transition otherwise).
    if (outcome?.success)
      startTransition(() => {
        setBody("");
        setAudience(DEFAULT_AUDIENCE);
      });
    return outcome;
  }, undefined);

  return (
    <form
      onSubmit={(submitted) => {
        submitted.preventDefault();
        const data = new FormData(submitted.currentTarget);
        startTransition(() => send(data));
      }}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="announcement-body">{t("message")}</FieldLabel>
          <Textarea
            id="announcement-body"
            name="body"
            rows={5}
            maxLength={MAX_BODY}
            required
            value={body}
            onChange={(typed) => setBody(typed.target.value)}
          />
          <Button type="button" variant="outline" className="self-start" onClick={() => setBody(reminder)}>
            {t("remind")}
          </Button>
        </Field>
        <FieldSet className="gap-3">
          <FieldLegend variant="label">{t("audience")}</FieldLegend>
          {SAVED_STATUSES.map((status) => (
            <Field key={status} orientation="horizontal">
              <Checkbox
                id={`audience-${status}`}
                name="audience"
                value={status}
                disabled={!mail}
                checked={audience.includes(status)}
                onCheckedChange={(checked) =>
                  setAudience(checked === true ? [...audience, status] : audience.filter((each) => each !== status))
                }
              />
              <FieldLabel htmlFor={`audience-${status}`}>{t(`status.${status}`)}</FieldLabel>
            </Field>
          ))}
        </FieldSet>
        <FormOutcome state={state} />
        <Button type="submit" disabled={sending} className="self-start">
          {t("send")}
        </Button>
      </FieldGroup>
    </form>
  );
}
