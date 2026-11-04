"use client";

import { Eye, MoreHorizontal, X } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { DangerZone } from "@/app/(host)/events/danger-zone";
import { DuplicateButton } from "@/app/(host)/events/duplicate-button";
import { publishAction, type PublishResult } from "@/events/editor-actions";
import { cn } from "@/lib/utils";
import { TITLE_ID } from "./editable-title";
import { EditorSheet } from "./sheet";
import { useEditor } from "./status";

// The editor's chrome sits over the invitation, which can be any colour, so it is dark frosted
// glass, as the Design drawer's button is. Focus rings it inside, in its own label's colour.
export const PILL =
  "dark inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border bg-popover/90 px-3.5 text-sm font-medium text-popover-foreground shadow-lg backdrop-blur-xl transition-colors hover:bg-popover focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-current";

export type EditorMenu = {
  eventId: string;
  title: string;
  link: string;
  // What the 0.4 manage page told the host about it: how often it was opened, the headcount
  // against the capacity, and the day it will be deleted once marked for its age.
  facts: string[];
  state: "draft" | "published" | "cancelled";
  // A co-host's editor says the event is theirs to co-host, as the 0.4 manage page did.
  coHost: boolean;
  // What this host's role may do (hosts/role.ts): a co-host has no Hosts, Invites or Delete.
  hosts: boolean;
  invites: boolean;
  duplicate: boolean;
  deletable: boolean;
  rsvps: number;
};

// The top of the editor (M4 spec, "The editor"): close, back to the dashboard; whether the event is
// a draft or live and how the last save went; Preview, the page as a guest sees it; Publish, or
// Share once it is live; and More, with everything the 0.4 manage page linked to.
export function EditorTopBar({ menu }: { menu: EditorMenu }) {
  const t = useTranslations("Editor");
  const { status, saves, error, retry, sheet, openSheet } = useEditor();
  const manage = useTranslations("Events.manage");
  const saving = status === "saving" ? t("saving") : status === "failed" ? t("failed") : t("saved");
  // Cancelling the event from More changes what the bar says, and closes More on it.
  const state = useRef(menu.state);
  useEffect(() => {
    if (state.current === menu.state) return;
    state.current = menu.state;
    openSheet(null);
  }, [menu.state, openSheet]);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 flex items-center gap-2 px-3 pt-[max(env(safe-area-inset-top),0.75rem)] pb-2 designing:md:right-101">
        <Link href="/dashboard" aria-label={t("close")} className={cn(PILL, "w-10 justify-center px-0")}>
          <X className="size-4.5" aria-hidden />
        </Link>
        <p role="status" data-slot="save-status" data-status={status} data-saves={saves} className={cn(PILL, "cursor-default gap-1 px-3 text-xs hover:bg-popover/90")}>
          <span>{menu.state === "draft" ? t("draft") : menu.state === "cancelled" ? t("cancelled") : t("live")}</span>
          <span aria-hidden>·</span>
          <span className={cn(status === "failed" && "text-destructive")}>{saving}</span>
        </p>
        {menu.coHost && <span className={cn(PILL, "cursor-default px-3 text-xs hover:bg-popover/90")}>{manage("coHost")}</span>}
        {status === "failed" && (
          <button type="button" onClick={retry} className={cn(PILL, "text-xs")}>
            {t("retry")}
          </button>
        )}
        <span className="grow" />
        <Link href={menu.link} className={cn(PILL, "max-sm:w-10 max-sm:justify-center max-sm:px-0")} aria-label={t("preview")}>
          <Eye className="size-4" aria-hidden />
          <span className="max-sm:sr-only">{t("preview")}</span>
        </Link>
        {menu.state === "draft" ? (
          <PublishButton eventId={menu.eventId} />
        ) : (
          <Link href={`/events/${menu.eventId}/share`} className={cn(PILL, "border-transparent bg-primary text-primary-foreground hover:bg-primary/90")}>
            {t("share")}
          </Link>
        )}
        <button
          type="button"
          onClick={() => openSheet("more")}
          aria-label={t("more")}
          aria-expanded={sheet === "more"}
          className={cn(PILL, "w-10 justify-center px-0")}
        >
          <MoreHorizontal className="size-4.5" aria-hidden />
        </button>
      </header>
      {status === "failed" && error && (
        <p role="alert" className="dark fixed inset-x-3 top-[calc(max(env(safe-area-inset-top),0.75rem)+3rem)] z-40 mx-auto max-w-md rounded-2xl border bg-popover/95 px-4 py-2.5 text-sm text-popover-foreground shadow-lg backdrop-blur-xl">
          {error}
        </p>
      )}
      <MoreSheet menu={menu} />
    </>
  );
}

// Publishing refuses without a title or a date, says which, and puts the focus on it: the title on
// the invitation, or the date sheet. Published, the event's share page opens.
function PublishButton({ eventId }: { eventId: string }) {
  const t = useTranslations("Editor");
  const { openSheet, status } = useEditor();
  const [refusal, publish, pending] = useActionState<PublishResult>(() => publishAction(eventId), undefined);
  const shown = useRef<PublishResult>(undefined);
  // The refusal goes once the host starts putting right what it named: at their next save.
  const [dismissed, setDismissed] = useState<PublishResult>(undefined);

  useEffect(() => {
    if (!refusal || refusal === shown.current) return;
    shown.current = refusal;
    if (refusal.missing === "title") document.getElementById(TITLE_ID)?.focus();
    else openSheet("when");
  }, [refusal, openSheet]);

  useEffect(() => {
    if (status === "saving" && shown.current) setDismissed(shown.current);
  }, [status]);

  return (
    <form action={publish}>
      <button type="submit" disabled={pending} className={cn(PILL, "border-transparent bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60")}>
        {t("publish")}
      </button>
      {refusal && refusal !== dismissed && (
        <p role="alert" className="dark fixed inset-x-3 top-[calc(max(env(safe-area-inset-top),0.75rem)+3rem)] z-40 mx-auto max-w-md rounded-2xl border bg-popover/95 px-4 py-2.5 text-sm text-popover-foreground shadow-lg backdrop-blur-xl">
          {refusal.error}
        </p>
      )}
    </form>
  );
}

// More: where the 0.4 manage page's cards and links went (M4 spec, "Where it lives").
function MoreSheet({ menu }: { menu: EditorMenu }) {
  const t = useTranslations("Editor");
  const manage = useTranslations("Events.manage");
  const { sheet, openSheet } = useEditor();
  const base = `/events/${menu.eventId}`;
  const links: [string, string][] = [
    [`${base}/guests`, manage("guests")],
    [`${base}/share`, manage("share")],
    ...(menu.hosts ? ([[`${base}/hosts`, manage("hosts")]] as [string, string][]) : []),
    ...(menu.invites ? ([[`${base}/invites`, manage("invites")]] as [string, string][]) : []),
    [`${base}/announcements`, manage("announcements")],
  ];
  return (
    <EditorSheet open={sheet === "more"} onOpenChange={(open) => openSheet(open ? "more" : null)} title={t("more")} tall>
      <div className="mb-4 flex flex-col gap-1">
        <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">{manage("link")}</p>
        <p className="font-mono text-sm break-all">{menu.link}</p>
        {menu.facts.map((fact) => (
          <p key={fact} className="text-sm text-muted-foreground">
            {fact}
          </p>
        ))}
      </div>
      <nav aria-label={t("more")}>
        <ul className="-mx-2 flex flex-col">
          {links.map(([href, label]) => (
            <li key={href}>
              <Link href={href} className="block rounded-xl px-3 py-3 text-sm font-medium hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring">
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mt-5 flex flex-col gap-4 border-t pt-5">
        {menu.duplicate && <DuplicateButton eventId={menu.eventId} label={manage("duplicate")} hint={manage("duplicateHint")} />}
        <DangerZone eventId={menu.eventId} title={menu.title} cancellable={menu.state === "published"} deletable={menu.deletable} rsvps={menu.rsvps} />
      </div>
    </EditorSheet>
  );
}
