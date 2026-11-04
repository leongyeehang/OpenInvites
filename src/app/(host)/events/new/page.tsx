import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireHost } from "@/auth/session";
import { hostNeedsVerification } from "@/auth/verification";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ClientMessages } from "@/locale/client-messages";
import { ResendVerificationForm } from "../../resend-verification-form";
import { StartEvent } from "./start-event";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Editor.new");
  return { title: t("title") };
}

export default async function NewEventPage() {
  const [host, t] = await Promise.all([requireHost(), getTranslations("Events")]);
  if (hostNeedsVerification(host)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            <h1>{t("verify.title")}</h1>
          </CardTitle>
          <CardDescription>{t("verify.text", { email: host.email })}</CardDescription>
        </CardHeader>
        <CardContent>
          <ResendVerificationForm label={t("verify.resend")} />
        </CardContent>
      </Card>
    );
  }
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{(await getTranslations("Editor.new"))("title")}</h1>
      <ClientMessages namespaces={["Editor.new"]}>
        <StartEvent />
      </ClientMessages>
    </>
  );
}
