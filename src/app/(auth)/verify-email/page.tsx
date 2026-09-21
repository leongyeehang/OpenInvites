import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export async function generateMetadata({ searchParams }: PageProps<"/verify-email">): Promise<Metadata> {
  const [t, params] = await Promise.all([getTranslations("Auth.verifyEmail"), searchParams]);
  return { title: typeof params.error === "string" ? t("failedTitle") : t("verifiedTitle") };
}

// Where Better Auth sends the browser after the link in a verification email. On failure
// it adds ?error=<code>; on success the host is signed in on this device as well.
export default async function VerifyEmailPage({ searchParams }: PageProps<"/verify-email">) {
  const [t, params] = await Promise.all([getTranslations("Auth.verifyEmail"), searchParams]);
  const failed = typeof params.error === "string";
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>{failed ? t("failedTitle") : t("verifiedTitle")}</h1>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p role="status">{failed ? t("failed") : t("verified")}</p>
      </CardContent>
      <CardFooter>
        <Button asChild>
          <Link href={failed ? "/sign-in" : "/dashboard"}>{failed ? t("toSignIn") : t("toDashboard")}</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
