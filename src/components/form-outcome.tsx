import type { FormState } from "@/lib/form-state";
import { FieldError } from "@/components/ui/field";

// One line of feedback under a form: the error, or the confirmation.
export function FormOutcome({ state }: { state: FormState }) {
  if (state?.error) return <FieldError>{state.error}</FieldError>;
  if (state?.success) {
    return (
      <p role="status" className="text-sm">
        {state.success}
      </p>
    );
  }
  return null;
}
