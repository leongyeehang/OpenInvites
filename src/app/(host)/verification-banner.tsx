import { getTranslations } from "next-intl/server";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ResendVerificationForm } from "./resend-verification-form";

// A soft banner under the header until the host verifies their email (dashboard spec, "The frame
// of every signed-in page"): the attention fill, the same words and the same Resend button, as wide
// as the header above it. The button is never in the alert's corner over the words, where shadcn
// puts it: at a phone's width it sits below them, and from `sm` in a column of its own beside
// them, so neither the words nor what Resend says once pressed run under it, in any language.
export async function VerificationBanner({ email }: { email: string }) {
  const t = await getTranslations("Auth.banner");
  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-2">
      <Alert className="rounded-2xl border-0 bg-attention-soft px-4 py-3 has-data-[slot=alert-action]:pr-4 sm:grid-cols-[1fr_auto] sm:gap-x-4 *:data-[slot=alert-title]:text-attention">
        <AlertTitle className="sm:col-start-1">{t("title")}</AlertTitle>
        <AlertDescription className="sm:col-start-1">
          <p>{t("text", { email })}</p>
        </AlertDescription>
        <AlertAction className="static mt-2 sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:mt-0 sm:max-w-56 sm:self-center">
          <ResendVerificationForm label={t("resend")} />
        </AlertAction>
      </Alert>
    </div>
  );
}
