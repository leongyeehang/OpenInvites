"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { acceptCoHostLinkAction } from "@/hosts/actions";

// The one button that makes the signed-in host a co-host. Accepted, it opens the event's manage
// page; a link that stopped working meanwhile says why here.
export function AcceptForm({ token }: { token: string }) {
  const t = useTranslations("CoHostLink");
  const [state, action, pending] = useActionState(acceptCoHostLinkAction.bind(null, token), undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <p className="text-muted-foreground">{t("intro")}</p>
      {state?.error && <FieldError>{state.error}</FieldError>}
      <Button type="submit" disabled={pending} className="self-start">
        {t("accept")}
      </Button>
    </form>
  );
}
