import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/auth/session";
import { enabledSocialProviders } from "@/auth/providers";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { SocialSignIn } from "../social-sign-in";
import { SignInForm } from "./sign-in-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth.signIn");
  return { title: t("title") };
}

const REFUSALS = ["HOST_INVITATION_REQUIRED", "HOST_INVITATION_UNUSABLE", "TOO_MANY_REQUESTS"] as const;

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  if (await getSession()) redirect("/dashboard");
  const [t, params] = await Promise.all([getTranslations("Auth.signIn"), searchParams]);
  // A Google or GitHub sign-up the registration mode refused, or a click the rate limits refused,
  // comes back with its code as `error`.
  const refusal = REFUSALS.find((code) => code === params.error);
  const notice = params.passwordChanged
    ? t("passwordChanged")
    : params.accountDeleted
      ? t("accountDeleted")
      : params.socialError
        ? t(refusal ?? "socialError")
        : undefined;
  return (
    <>
      {notice && (
        <Alert>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle>
            <h1>{t("title")}</h1>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <SignInForm />
          <SocialSignIn providers={enabledSocialProviders()} namespace="Auth.signIn" />
        </CardContent>
        <CardFooter className="flex-col items-start gap-2 text-sm text-muted-foreground">
          <Link href="/forgot-password" className="text-foreground underline underline-offset-4">
            {t("forgotPassword")}
          </Link>
          <p>
            {t("noAccount")}{" "}
            <Link href="/sign-up" className="text-foreground underline underline-offset-4">
              {t("signUp")}
            </Link>
          </p>
        </CardFooter>
      </Card>
    </>
  );
}
