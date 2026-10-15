"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { stopMailAction } from "./actions";

// The address on file and the one button that blanks it, which give way to the news that it is done.
export function StopForm({ token, email }: { token: string; email: string }) {
  const t = useTranslations("StopMail");
  const [state, action, pending] = useActionState(stopMailAction.bind(null, token), undefined);
  if (state?.success) return <p role="status">{state.success}</p>;
  return (
    <form action={action} className="flex flex-col gap-4">
      <p className="text-muted-foreground">{t("onFile", { email })}</p>
      <Button type="submit" disabled={pending} className="self-start">
        {t("stop")}
      </Button>
    </form>
  );
}
