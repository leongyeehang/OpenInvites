import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import type { Host } from "@/auth/session";
import { eventsOwnedAtLimit } from "@/events/limit";
import { instanceDisplayName } from "@/instance/home";
import { homePage, isOperator } from "@/instance/repository";
import { initialsOf } from "@/themes/poster-parts";
import { AccountMenu } from "./account-menu";

// The header of every signed-in page (dashboard spec, "The frame of every signed-in page"): the
// site's name, the way to a new event while the host may make one, and their initials opening the
// account menu, which holds Site settings for the operator alone. Its slot also puts the page on
// the host ground (globals.css). Below 360px the New event pill is its "+" alone, still named.
export async function HostHeader({ host }: { host: Host }) {
  const [t, page, operator, atLimit] = await Promise.all([
    getTranslations("Host.header"),
    homePage(),
    isOperator(host.id),
    eventsOwnedAtLimit(host.id),
  ]);
  return (
    <header data-slot="host-header">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-3 px-4">
        {/* Cut short when long, which would clip an outline: its focus is a ring of its own. */}
        <Link
          href="/dashboard"
          className="min-w-0 truncate rounded-md text-lg font-semibold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {instanceDisplayName(page)}
        </Link>
        <nav className="flex shrink-0 items-center gap-2">
          {atLimit === undefined && (
            <Link
              href="/events/new"
              aria-label={t("newEvent")}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-3 text-sm font-semibold text-primary-foreground outline-none hover:bg-primary/85 focus-visible:ring-3 focus-visible:ring-ring/50 min-[360px]:pr-4"
            >
              <Plus aria-hidden className="size-4" />
              <span aria-hidden className="hidden min-[360px]:inline">
                {t("newEvent")}
              </span>
            </Link>
          )}
          <AccountMenu
            initials={initialsOf(host.name)}
            name={host.name}
            email={host.email}
            siteSettings={operator}
            labels={{ menu: t("accountMenu"), account: t("account"), siteSettings: t("instanceSettings"), signOut: t("signOut") }}
          />
        </nav>
      </div>
    </header>
  );
}
