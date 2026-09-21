import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireHost } from "@/auth/session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChangeEmailForm, ChangePasswordForm, DeleteAccountDialog, DisplayNameForm } from "./account-forms";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Account");
  return { title: t("title") };
}

export default async function AccountPage() {
  const [host, t] = await Promise.all([requireHost(), getTranslations("Account")]);
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>{t("displayName.title")}</h2>
          </CardTitle>
          <CardDescription>{t("displayName.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <DisplayNameForm name={host.name} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>{t("email.title")}</h2>
          </CardTitle>
          <CardDescription>{t("email.current", { email: host.email })}</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangeEmailForm />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>{t("password.title")}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle>
            <h2>{t("delete.title")}</h2>
          </CardTitle>
          <CardDescription>{t("delete.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteAccountDialog />
        </CardContent>
      </Card>
    </>
  );
}
