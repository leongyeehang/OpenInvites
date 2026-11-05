import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

// The pieces of the Poster layout (poster-layout.tsx) that other pages draw too: the home page
// (src/app/page.tsx), the guest list and the Thread layout. They sit apart from the layout, which
// brings an event page's sections with it.

// The small tile a row's icon sits in, in the accent's ink: the details' rows, and the home page's.
export function IconTile({ children }: { children: ReactNode }) {
  return (
    <span aria-hidden className="grid size-9 place-items-center rounded-xl bg-theme-glass-strong text-theme-accent-ink">
      {children}
    </span>
  );
}

// Who is behind the page, under its title: the initials in the accent's circle, then the line that
// names them ("Hosted by" on an event page, "Run by" on the home page).
export function HostLine({ name, className, children }: { name: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn("mt-4 flex items-center gap-3 px-5 sm:px-6", className)}>
      <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-theme-accent text-xs font-semibold text-theme-on-accent">
        {initialsOf(name)}
      </span>
      <p className="text-sm text-theme-text-muted">{children}</p>
    </div>
  );
}

// Each piece rises into place on load. Under reduced motion none of these classes apply, so
// nothing moves. The home page's pieces rise as an invitation's do.
const rise = "motion-safe:animate-in motion-safe:slide-in-from-bottom-4 motion-safe:fill-mode-both motion-safe:duration-700 motion-safe:ease-out";
export const entrance = cn(rise, "motion-safe:fade-in");
// The invitation fades in from a trace (1%) rather than from nothing, which looks the same. A
// browser counts the largest thing it paints only where it is visible when painted, and a piece
// faded in from nothing is painted once, unseen, and then only faded: the invitation would never
// count, and the page's largest paint would wait for whatever is drawn after the scripts run
// (the countdown), as a slow phone's first view of the page. From 1% it counts at once.
export const invitationEntrance = cn(rise, "motion-safe:fade-in-1");

// The small spaced capitals of the details' and the panels' headings.
export const CAPS = "text-xs font-medium tracking-label uppercase";

// A heading with an `id` is where the focus is sent once something under it is deleted, so it can
// take the focus, though it is never a stop for Tab.
export function SectionLabel({ icon: Icon, id, children }: { icon?: ComponentType<{ className?: string }>; id?: string; children: ReactNode }) {
  return (
    <h2 id={id} tabIndex={id ? -1 : undefined} className={cn(CAPS, "mb-3 flex items-center gap-2 text-theme-text-faint outline-none")}>
      {Icon && <Icon className="size-3.5" aria-hidden />}
      {children}
    </h2>
  );
}

export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}
