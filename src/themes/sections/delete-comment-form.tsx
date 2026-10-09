"use client";

import { useActionState, type ReactNode } from "react";

// The form in a comment's delete confirmation: what the dialog asks, then its buttons. Deleted, the
// comment goes with the page drawn again; refused as too fast, the dialog says so above its
// buttons, as a refused post does above Post.
export function DeleteCommentForm({
  action,
  tooFast,
  footer,
  children,
}: {
  action: () => Promise<{ error?: "tooFast" }>;
  tooFast: string;
  footer: ReactNode;
  children: ReactNode;
}) {
  const [state, send] = useActionState(() => action(), undefined);
  return (
    <form action={send}>
      {children}
      {state?.error && (
        <p role="alert" className="pt-4 text-sm font-medium">
          {tooFast}
        </p>
      )}
      {footer}
    </form>
  );
}
