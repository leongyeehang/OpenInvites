"use client";

import { useActionState } from "react";
import { resendVerificationEmail } from "@/auth/actions";
import { FormOutcome } from "@/components/form-outcome";
import { Button } from "@/components/ui/button";

// The resend action as a button, for the banner and for the gate on creating events.
export function ResendVerificationForm({ label }: { label: string }) {
  const [state, action, pending] = useActionState(resendVerificationEmail, undefined);
  return (
    <form action={action} className="flex flex-col gap-2">
      <FormOutcome state={state} />
      <Button type="submit" size="sm" variant="outline" disabled={pending} className="self-start">
        {label}
      </Button>
    </form>
  );
}
