"use client";

import { Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

const NOTHING_TO_SUBSCRIBE_TO = () => () => {};

// Whether this browser has a share sheet is something only the browser knows, so the button
// appears once it has answered rather than flickering in after hydration (as on the share page).
function useShareSheet(): boolean {
  return useSyncExternalStore(
    NOTHING_TO_SUBSCRIBE_TO,
    () => typeof navigator !== "undefined" && typeof navigator.share === "function",
    () => false,
  );
}

// Share beside an invite's link (M6 spec, "The invitation email"): the device's share sheet, with
// the invitation's words and the guest's personal invite link, to send it in whichever app the host
// talks to the guest in. A browser without one has only Copy, beside it. Every row has one, so its
// name says whose link it shares. A sheet the host closes is no error.
export function ShareInviteLink({ link, name, title, text }: { link: string; name: string; title: string; text: string }) {
  const t = useTranslations("Invites");
  const canShare = useShareSheet();
  if (!canShare) return null;

  return (
    <Button type="button" variant="outline" size="sm" aria-label={t("shareLabel", { name })} onClick={() => navigator.share({ title, text, url: link }).catch(() => {})}>
      <Share2 />
      {t("share")}
    </Button>
  );
}
