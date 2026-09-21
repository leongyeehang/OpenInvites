import { getTranslations } from "next-intl/server";
import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/auth/actions";
import { requireHost } from "@/auth/session";
import { needsEmailVerification } from "@/auth/verification";
import { Button } from "@/components/ui/button";
import { isMailConfigured } from "@/mail/config";
import { VerificationBanner } from "./verification-banner";

// The host area: a header with the host's display name on every page. Pages call
// requireHost() themselves too; this layout is for the header, not the guard.
export default async function HostLayout({ children }: { children: ReactNode }) {
  const [host, t, home] = await Promise.all([requireHost(), getTranslations("Host.header"), getTranslations("Home")]);
  return (
    <>
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/dashboard" className="font-semibold tracking-tight">
            {home("title")}
          </Link>
          <nav className="flex items-center gap-1">
            <Button asChild variant="ghost">
              <Link href="/account" title={t("account")}>
                {host.name}
              </Link>
            </Button>
            <form action={signOut}>
              <Button type="submit" variant="outline">
                {t("signOut")}
              </Button>
            </form>
          </nav>
        </div>
      </header>
      {needsEmailVerification({ mailConfigured: isMailConfigured(), emailVerified: host.emailVerified }) && (
        <VerificationBanner email={host.email} />
      )}
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8">{children}</main>
    </>
  );
}
