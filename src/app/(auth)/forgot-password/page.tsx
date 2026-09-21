import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { operatorContactEmail } from "@/instance/env";
import { isMailConfigured } from "@/mail/config";
import { ForgotPasswordForm } from "./forgot-password-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth.forgotPassword");
  return { title: t("title") };
}

// With SMTP, a reset link by email. Without it, the operator resets passwords with a
// command inside the container, so this page says whom to ask.
export default async function ForgotPasswordPage() {
  const t = await getTranslations("Auth.forgotPassword");
  const mail = isMailConfigured();
  const operator = operatorContactEmail();
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>{t("title")}</h1>
        </CardTitle>
        <CardDescription>{mail ? t("description") : t("noMail")}</CardDescription>
      </CardHeader>
      <CardContent>
        {mail ? (
          <ForgotPasswordForm />
        ) : (
          <p>
            {operator
              ? t.rich("contactOperator", {
                  email: operator,
                  link: (chunks) => (
                    <a href={`mailto:${operator}`} className="underline underline-offset-4">
                      {chunks}
                    </a>
                  ),
                })
              : t("contactOperatorUnknown")}
          </p>
        )}
      </CardContent>
      <CardFooter className="text-sm">
        <Link href="/sign-in" className="underline underline-offset-4">
          {t("backToSignIn")}
        </Link>
      </CardFooter>
    </Card>
  );
}
