import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/auth/session";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { SignInForm } from "./sign-in-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth.signIn");
  return { title: t("title") };
}

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  if (await getSession()) redirect("/dashboard");
  const [t, params] = await Promise.all([getTranslations("Auth.signIn"), searchParams]);
  const notice = params.passwordChanged ? t("passwordChanged") : params.accountDeleted ? t("accountDeleted") : undefined;
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
        <CardContent>
          <SignInForm />
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
