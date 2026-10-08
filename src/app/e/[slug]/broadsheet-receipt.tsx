"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useRef, type ReactNode, type RefObject } from "react";
import type { GuestRsvp } from "@/rsvps/guest";
import { useCopyLink } from "./use-copy-link";

const LINK = "cursor-pointer underline decoration-theme-accent decoration-2 underline-offset-4 hover:opacity-80 disabled:cursor-default disabled:opacity-50";

// The Broadsheet's confirmation, in the ballot's card once the RSVP is saved (spec, "Broadsheet"):
// a "Received" stamp in the accent, what the guest answered, the calendar for a guest who is
// coming, the private link that changes the RSVP from any device, and the three ways on. It sits
// on the card's glass as the Poster's confirmation does, the stamp's word as accent ink on it.
export function BroadsheetReceipt({
  answer,
  headingRef,
  onAmend,
  onChangeAnswer,
  onRemove,
  removing,
  refusal,
  calendar,
}: {
  answer: GuestRsvp;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onAmend: () => void;
  onChangeAnswer: () => void;
  onRemove: () => void;
  removing: boolean;
  // Why removing it was just refused.
  refusal?: string;
  calendar?: ReactNode;
}) {
  const t = useTranslations("Rsvp");
  const format = useFormatter();
  const shownLink = useRef<HTMLSpanElement>(null);
  const link = useCopyLink(answer.editLink, shownLink);
  const named = answer.plusOneNames.filter(Boolean);

  return (
    <div className="mt-5">
      <div className="relative">
        {/* It comes down onto the card at its tilt when motion is welcome; otherwise it is there. */}
        <p
          data-slot="received-stamp"
          className="absolute -top-1 right-0 -rotate-8 border-[3px] border-theme-accent px-2 py-0.5 font-mono text-xs font-bold tracking-[0.2em] text-theme-accent-ink uppercase motion-safe:animate-theme-stamp-in"
        >
          {t("ballot.received")}
        </p>
        <h3 ref={headingRef} tabIndex={-1} className="pr-28 font-title text-4xl leading-tight outline-none">
          {t(`done.${answer.status}`)}
        </h3>
        <p className="mt-1 text-theme-text-muted">
          {answer.status === "cant" ? t("summary.cant", { name: answer.name }) : t("summary.coming", { name: answer.name, count: answer.plusOnes })}
        </p>
        {named.length > 0 && <p className="text-sm text-theme-text-faint">{t("summary.bringing", { names: format.list(named) })}</p>}
        {answer.email && <p className="text-sm text-theme-text-faint">{t("summary.email", { email: answer.email })}</p>}
      </div>

      {calendar && answer.status !== "cant" && <div className="mt-6">{calendar}</div>}

      <div className="mt-6">
        <p className="label-mono text-theme-text-muted">{t("editLink.label")}</p>
        <div className="mt-1 flex items-center justify-between gap-3 border-b border-theme-text/20 pb-2">
          <span ref={shownLink} className={`min-w-0 font-mono text-sm ${link.failed ? "break-all" : "truncate"}`}>
            {answer.editLink}
          </span>
          <button
            type="button"
            onClick={link.copy}
            className="label-mono inline-flex h-9 shrink-0 cursor-pointer items-center text-theme-accent-ink hover:underline"
          >
            {link.copied ? t("editLink.copied") : t("editLink.copy")}
          </button>
        </div>
        <p className="mt-2 text-xs text-theme-text-faint">{t("editLink.hint")}</p>
      </div>

      <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <button type="button" onClick={onAmend} className={LINK}>
          {t("ballot.amend")}
        </button>
        <button type="button" onClick={onChangeAnswer} className={LINK}>
          {t("ballot.change")}
        </button>
        <button type="button" onClick={onRemove} disabled={removing} className={LINK}>
          {t("remove")}
        </button>
      </div>
      {refusal && (
        <p role="alert" className="mt-3 text-sm font-medium">
          {refusal}
        </p>
      )}
    </div>
  );
}
