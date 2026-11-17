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
// The form is sent from its submit event: React resets a form after an action it runs itself, sent
// or refused, and each checkbox (Radix) answers the reset by setting itself back to the value it
// was first drawn with, the draft's, which raced the audience set here and undid a refusal's (flake
// fix, M8 ticket 14). The handler stops the submit event, and React then runs no action of its own
// and resets nothing (react-dom's form actions: a submit whose default was prevented starts no
// action). The form still has its `action`, so that a press before the page is hydrated is held
// by React and sent once it is, rather than the browser submitting the message into the address
// (the voting part's review, finding 3). That replay runs `action` itself, so it resets the form;
// only the boxes can then show the draft's audience again, and the message has gone.
//
// Once posted, the address loses `?draft=`, without a new history entry, so a reload does not write
// the message into the form again (the voting part's review).
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
    if (outcome?.success) {
      startTransition(() => {
        setBody("");
        setAudience(DEFAULT_AUDIENCE);
      });
      const query = new URLSearchParams(window.location.search);
      if (query.has("draft")) {
        query.delete("draft");
        const rest = query.toString();
        window.history.replaceState(null, "", `${window.location.pathname}${rest ? `?${rest}` : ""}${window.location.hash}`);
      }
    }
    return outcome;
  }, undefined);

  return (
    <form
      action={send}
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
