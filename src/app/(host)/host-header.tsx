import { Settings } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { signOut } from "@/auth/actions";
import type { Host } from "@/auth/session";
import { Button } from "@/components/ui/button";
import { isOperator } from "@/instance/repository";

// The header of every signed-in page: the host's display name, signing out, and for the operator
// alone, the way to the instance settings. On a phone that link is its icon, named for a screen reader.
export async function HostHeader({ host }: { host: Host }) {
  const [t, home, operator] = await Promise.all([getTranslations("Host.header"), getTranslations("Home"), isOperator(host.id)]);
  return (
    <header className="border-b">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/dashboard" className="font-semibold tracking-tight">
          {home("title")}
        </Link>
        <nav className="flex items-center gap-1">
          {operator && (
            <Button asChild variant="ghost">
              <Link href="/instance">
                <Settings aria-hidden />
                <span className="sr-only sm:not-sr-only">{t("instanceSettings")}</span>
              </Link>
            </Button>
          )}
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
  );
}
