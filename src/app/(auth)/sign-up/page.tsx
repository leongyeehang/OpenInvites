import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/auth/session";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { SignUpForm } from "./sign-up-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth.signUp");
  return { title: t("title") };
}

export default async function SignUpPage() {
  if (await getSession()) redirect("/dashboard");
  const t = await getTranslations("Auth.signUp");
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>{t("title")}</h1>
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <SignUpForm />
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
  );
}
