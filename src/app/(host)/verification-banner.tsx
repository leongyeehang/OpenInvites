import { getTranslations } from "next-intl/server";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ResendVerificationForm } from "./resend-verification-form";

// A soft banner under the header until the host verifies their email (dashboard spec, "The frame
// of every signed-in page"): the attention fill, the same words and the same Resend button.
export async function VerificationBanner({ email }: { email: string }) {
  const t = await getTranslations("Auth.banner");
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-2">
      <Alert className="rounded-2xl border-0 bg-attention-soft px-4 py-3 *:data-[slot=alert-title]:text-attention">
        <AlertTitle>{t("title")}</AlertTitle>
        <AlertDescription>
          <p>{t("text", { email })}</p>
        </AlertDescription>
        <AlertAction>
          <ResendVerificationForm label={t("resend")} />
        </AlertAction>
      </Alert>
    </div>
  );
}
