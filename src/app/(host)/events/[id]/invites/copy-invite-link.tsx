"use client";

import { Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";

// Copy beside an invite's link, which the host sends its guest themselves. As on the share page, a
// browser that refuses the clipboard leaves the link on the page to select by hand, and "Copied" is
// said for a moment rather than forever. Every row has one, so its name says whose link it copies.
export function CopyInviteLink({ link, name }: { link: string; name: string }) {
  const t = useTranslations("Invites");
  const [copied, setCopied] = useState(false);

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
    <Button type="button" variant="outline" size="sm" onClick={copy} aria-label={copied ? undefined : t("copyLabel", { name })} aria-live="polite">
      {copied ? <Check /> : <Copy />}
      {copied ? t("copied") : t("copy")}
    </Button>
  );
}
