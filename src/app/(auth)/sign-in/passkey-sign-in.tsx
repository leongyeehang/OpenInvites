"use client";

import { KeyRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { outcomeOf, passkeyAuth, type PasskeyOutcome } from "@/auth/passkey-client";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";

// Signing in with a passkey (M4 ticket 08): the button, and, where the browser can, its passkeys
// offered in the email field as it is focused (the field's autocomplete names webauthn). Signed in,
// the host goes where signing in leads.
export function PasskeySignIn({ next }: { next: string }) {
  const t = useTranslations("Auth.signIn");
  const [pending, start] = useTransition();
  const [outcome, setOutcome] = useState<PasskeyOutcome>();

  const finish = (done: PasskeyOutcome) => {
    if (done === "done") window.location.assign(next);
    else if (done !== "cancelled") setOutcome(done);
  };

  useEffect(() => {
    let live = true;
    void (async () => {
      const conditional = await globalThis.PublicKeyCredential?.isConditionalMediationAvailable?.().catch(() => false);
      if (!conditional || !live) return;
      const result = await passkeyAuth.signIn.passkey({ autoFill: true });
      if (live) finish(outcomeOf(result));
    })();
    return () => {
      live = false;
    };
    // Once, as the page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setOutcome(undefined);
            finish(outcomeOf(await passkeyAuth.signIn.passkey()));
          })
        }
      >
        <KeyRound aria-hidden />
        {t("passkey")}
      </Button>
      {outcome && <FieldError>{outcome === "tooFast" ? t("TOO_MANY_REQUESTS") : t("passkeyFailed")}</FieldError>}
    </div>
  );
}
