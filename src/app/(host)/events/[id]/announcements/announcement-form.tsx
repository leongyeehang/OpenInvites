"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { postAnnouncementAction } from "@/announcements/actions";
import { DEFAULT_AUDIENCE, MAX_BODY } from "@/announcements/announcement";
import { FormOutcome } from "@/components/form-outcome";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import type { FormState } from "@/lib/form-state";
import { RSVP_STATUSES, type RsvpStatus } from "@/rsvps/form";

// What the host says, and which guests are emailed it, by status. "Send a reminder now" fills in a
// reminder, already written in the host's language, which they may change and send like any other
// announcement. The fields are the form's own state, so a refusal leaves them as they were; once
// the announcement is posted they start again. Without mail the boxes are shown but cannot change.
export function AnnouncementForm({ eventId, reminder, mail }: { eventId: string; reminder: string; mail: boolean }) {
  const t = useTranslations("Announcements");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<readonly RsvpStatus[]>(DEFAULT_AUDIENCE);
  const [state, send, sending] = useActionState(async (previous: FormState, formData: FormData) => {
    const outcome = await postAnnouncementAction(eventId, previous, formData);
    if (outcome?.success) {
      setBody("");
      setAudience(DEFAULT_AUDIENCE);
    }
    return outcome;
  }, undefined);

  return (
    <form action={send}>
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
          {RSVP_STATUSES.map((status) => (
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
