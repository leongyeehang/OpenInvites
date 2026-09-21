import { getTranslations } from "next-intl/server";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ResendVerificationForm } from "./resend-verification-form";

export async function VerificationBanner({ email }: { email: string }) {
  const t = await getTranslations("Auth.banner");
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-4">
      <Alert>
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
