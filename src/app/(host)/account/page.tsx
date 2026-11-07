import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { signOut } from "@/auth/actions";
import { passkeysAvailable } from "@/auth/passkeys";
import { listPasskeys } from "@/auth/passkey-store";
import { requireHost } from "@/auth/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { baseUrl } from "@/instance/env";
import { ClientMessages } from "@/locale/client-messages";
import { ChangeEmailForm, ChangePasswordForm, DeleteAccountDialog, DisplayNameForm } from "./account-forms";
import { Passkeys } from "./passkeys";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Account");
  return { title: t("title") };
}

export default async function AccountPage() {
  const [host, t, header, locale] = await Promise.all([requireHost(), getTranslations("Account"), getTranslations("Host.header"), getLocale()]);
  // Passkeys only where a browser offers them (auth/passkeys.ts); elsewhere the card says why.
  const withPasskeys = passkeysAvailable(baseUrl());
  const day = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const passkeys = withPasskeys
    ? (await listPasskeys(host.id)).map(({ id, name, createdAt, lastUsedAt }) => ({
        id,
        name,
        created: createdAt && day.format(createdAt),
        lastUsed: lastUsedAt && day.format(lastUsedAt),
      }))
    : [];
  return (
    <ClientMessages namespaces={["Account.displayName", "Account.email", "Account.password", "Account.passkeys", "Account.delete"]}>
      {/* Sign out is here as well as in the account menu, so a browser that has not run the menu's
          script (the initials are then a link to this page) can still sign out. */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <form action={signOut}>
          <Button type="submit" variant="outline">
            {header("signOut")}
          </Button>
        </form>
      </div>
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
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>{t("passkeys.title")}</h2>
          </CardTitle>
          <CardDescription>{withPasskeys ? t("passkeys.description") : t("passkeys.unavailable")}</CardDescription>
        </CardHeader>
        {withPasskeys && (
          <CardContent>
            <Passkeys passkeys={passkeys} />
          </CardContent>
        )}
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
    </ClientMessages>
  );
}
