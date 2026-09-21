import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ResetPasswordForm } from "./reset-password-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth.resetPassword");
  return { title: t("title") };
}

// Reached from the link in the reset email, which carries the token.
export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const [t, params] = await Promise.all([getTranslations("Auth.resetPassword"), searchParams]);
  const token = typeof params.token === "string" ? params.token : undefined;
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>{t("title")}</h1>
        </CardTitle>
      </CardHeader>
      <CardContent>{token ? <ResetPasswordForm token={token} /> : <p role="alert">{t("missingToken")}</p>}</CardContent>
      <CardFooter className="text-sm">
        <Link href="/forgot-password" className="underline underline-offset-4">
          {t("requestAgain")}
        </Link>
      </CardFooter>
    </Card>
  );
}
