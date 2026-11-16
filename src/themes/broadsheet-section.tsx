import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

// A part of the Broadsheet's paper (spec, "Broadsheet"): a section under a rule and its label in
// small capitals, which the layout draws each of the page's sections in (M8 ticket 27), and the
// details' description draws itself in. A label with an id is where the focus is sent once
// something under it is deleted, so it can take the focus, though it is never a stop for Tab.
export function BroadsheetSection({
  label,
  headingId,
  className,
  children,
  ...props
}: { label: string | null; headingId?: string; children: ReactNode } & Omit<ComponentProps<"section">, "children">) {
  return (
    <section className={cn("border-t border-theme-text/80 pt-5", className)} {...props}>
      {label !== null && (
        <h2 id={headingId} tabIndex={headingId ? -1 : undefined} className="label-mono mb-4 text-theme-text-muted outline-none">
          {label}
        </h2>
      )}
      {children}
    </section>
  );
}
