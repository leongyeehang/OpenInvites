"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect, useRef } from "react";
import { FormOutcome } from "@/components/form-outcome";
import { Button } from "@/components/ui/button";
import { newEventAction } from "@/events/editor-actions";

// New event makes a blank draft and opens it in the editor (M4 spec, "Where it lives"). It is a
// post the page sends as soon as it is on screen, with the zone of the host's device, which only
// the browser knows: a page that made an event as it was fetched would make one for every link
// prefetched to it. Without scripts, or when it is refused (at the operator's limit), the button
// is there to send it.
export function StartEvent() {
  const t = useTranslations("Editor.new");
  const [state, start, pending] = useActionState(newEventAction, undefined);
  const form = useRef<HTMLFormElement>(null);
  const zone = useRef<HTMLInputElement>(null);
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current || !form.current || !zone.current) return;
    sent.current = true;
    zone.current.value = Intl.DateTimeFormat().resolvedOptions().timeZone;
    form.current.requestSubmit();
  }, []);

  return (
    <form ref={form} action={start} className="flex flex-col items-start gap-3">
      <input ref={zone} type="hidden" name="timeZone" defaultValue="UTC" />
      {pending && !state && <p className="text-muted-foreground">{t("starting")}</p>}
      <FormOutcome state={state} />
      <Button type="submit" disabled={pending}>
        {t("start")}
      </Button>
    </form>
  );
}
