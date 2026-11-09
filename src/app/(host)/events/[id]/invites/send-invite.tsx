"use client";

import { Mail } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { FormOutcome } from "@/components/form-outcome";
import { useFocusKept } from "@/components/use-focus-kept";
import { Button } from "@/components/ui/button";
import { sendInviteAction, sendUnsentInvitesAction } from "@/invites/actions";

// Send on an invite's row, and Send again once its invitation has gone (M6 spec, "The invitation
// email"); the page shows it only when the invitation can be emailed. What happened is said under
// it, at the end of the row of buttons. Every row has one, so its name says whose invitation it
// sends. Pressed from the keyboard, it keeps the focus, as Send again.
export function SendInvite({ eventId, inviteId, name, again }: { eventId: string; inviteId: string; name: string; again: boolean }) {
  const t = useTranslations("Invites");
  const [state, send, sending] = useActionState(sendInviteAction.bind(null, eventId, inviteId), undefined);
  const [button, keepFocus] = useFocusKept(sending);
  const when = again ? "yes" : "no";

  return (
    <form action={send} onSubmit={keepFocus} className="contents">
      <Button ref={button} type="submit" variant="outline" size="sm" disabled={sending} aria-label={t("sendLabel", { again: when, name })}>
        <Mail />
        {t("send", { again: when })}
      </Button>
      <div className="order-last basis-full empty:hidden">
        <FormOutcome state={state} />
      </div>
    </form>
  );
}

// "Send to everyone not yet sent", above the list, with how many that is. It stays once they are
// all sent, so that what it did is still said under it: then it reads as disabled and does
// nothing, but keeps its place in the tab order, so the focus it had when it sent them stays on it,
// as Send's does (M6 final review). While it sends, it is disabled outright.
export function SendUnsentInvites({ eventId, count }: { eventId: string; count: number }) {
  const t = useTranslations("Invites");
  const [state, send, sending] = useActionState(sendUnsentInvitesAction.bind(null, eventId), undefined);
  const [button, keepFocus] = useFocusKept(sending);
  const none = count === 0;

  return (
    <form action={send} onSubmit={keepFocus} className="flex flex-col items-start gap-2">
      <Button
        ref={button}
        type="submit"
        variant="outline"
        disabled={sending}
        aria-disabled={none || undefined}
        onClick={(click) => {
          if (none) click.preventDefault();
        }}
        className="aria-disabled:cursor-default aria-disabled:opacity-50"
      >
        <Mail />
        {t("sendAll", { count })}
      </Button>
      <FormOutcome state={state} />
    </form>
  );
}
