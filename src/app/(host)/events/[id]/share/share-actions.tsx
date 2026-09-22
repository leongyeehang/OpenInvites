"use client";

import { Check, Copy, Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

const NOTHING_TO_SUBSCRIBE_TO = () => () => {};

// Whether this browser has a share sheet is something only the browser knows, so the button
// appears once it has answered rather than flickering in after hydration.
function useShareSheet(): boolean {
  return useSyncExternalStore(
    NOTHING_TO_SUBSCRIBE_TO,
    () => typeof navigator !== "undefined" && typeof navigator.share === "function",
    () => false,
  );
}

export function ShareActions({ link, title }: { link: string; title: string }) {
  const t = useTranslations("Events.share");
  const [copied, setCopied] = useState(false);
  const canShare = useShareSheet();

  // A clipboard a browser refuses is not an error worth a dialog; the link is on the page to
  // select by hand. Saying "Copied" forever would be a lie, so it says it for a moment.
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2_000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        onClick={copy}
        aria-live="polite"
      >
        {copied ? <Check /> : <Copy />}
        {copied ? t("copied") : t("copy")}
      </Button>
      {canShare && (
        <Button type="button" variant="outline" onClick={() => navigator.share({ title, url: link }).catch(() => {})}>
          <Share2 /> {t("share")}
        </Button>
      )}
    </div>
  );
}
