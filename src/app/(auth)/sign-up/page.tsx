import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/auth/session";
import { enabledSocialProviders } from "@/auth/providers";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { hostInvitationState } from "@/instance/host-invitation";
import { HOST_INVITATION_COOKIE } from "@/instance/host-invitation-token";
import { signUpNotice } from "@/instance/registration";
import { findHostInvitation, hasAccounts, registrationMode } from "@/instance/repository";
import { ClientMessages } from "@/locale/client-messages";
import { SocialSignIn } from "../social-sign-in";
import { SignUpForm } from "./sign-up-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth.signUp");
  return { title: t("title") };
}

// Says up front what the registration mode asks of this visitor, given the host invitation whose
// link they opened, if any; a pending one addressed to an email fills the form in with it.
export default async function SignUpPage() {
  if (await getSession()) redirect("/dashboard");
  const [t, cookieStore, mode, accounts] = await Promise.all([
    getTranslations("Auth.signUp"),
    cookies(),
    registrationMode(),
    hasAccounts(),
  ]);
  const token = cookieStore.get(HOST_INVITATION_COOKIE)?.value;
  const invitation = token ? await findHostInvitation(token) : undefined;
  const pending = invitation && hostInvitationState(invitation, new Date()) === "pending" ? invitation : undefined;
  const notice = signUpNotice({ mode, hasAccounts: accounts, invitation: !token ? "none" : pending ? "pending" : "unusable" });
  return (
    <>
      {notice && (
        <Alert>
          <AlertDescription>{t(notice)}</AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle>
            <h1>{t("title")}</h1>
          </CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ClientMessages namespaces={["Auth.signUp"]}>
            <SignUpForm email={pending?.email ?? undefined} />
          </ClientMessages>
          <SocialSignIn providers={enabledSocialProviders()} namespace="Auth.signUp" />
        </CardContent>
        <CardFooter className="text-sm text-muted-foreground">
          <p>
            {t("haveAccount")}{" "}
            <Link href="/sign-in" className="text-foreground underline underline-offset-4">
              {t("signIn")}
            </Link>
          </p>
        </CardFooter>
      </Card>
    </>
  );
}
