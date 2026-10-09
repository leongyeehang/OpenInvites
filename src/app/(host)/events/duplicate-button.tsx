"use client";

import { useActionState } from "react";
import { FormOutcome } from "@/components/form-outcome";
import { Button } from "@/components/ui/button";
import { duplicateEventAction } from "@/events/actions";

// Duplicate, with the refusal beside it for a host who has as many events as the operator allows.
export function DuplicateButton({ eventId, label, hint }: { eventId: string; label: string; hint: string }) {
  const [state, action, pending] = useActionState(duplicateEventAction.bind(null, eventId), undefined);
  return (
    <form action={action} className="flex flex-col gap-1">
      <Button type="submit" variant="outline" title={hint} disabled={pending} className="self-start">
        {label}
      </Button>
      <FormOutcome state={state} />
    </form>
  );
}
