import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import type { Host } from "@/auth/session";
import { Button } from "@/components/ui/button";
import { eventsOwnedAtLimit } from "@/events/limit";
import { instanceDisplayName } from "@/instance/home";
import { homePage, isOperator } from "@/instance/repository";
import { initialsOf } from "@/themes/poster-parts";
import { AccountMenu } from "./account-menu";

// The header of every signed-in page (dashboard spec, "The frame of every signed-in page"): the
// site's name, the way to a new event while the host may make one, and their initials opening the
// account menu, which holds Site settings for the operator alone. It is a bar of strong glass over
// the page's poster (M8 ticket 20), as tall with its edge as without. The New event pill is a
// default button, which on a site page keeps the whole accent hovered, which its label is proven
// on, and shows the hover by an edge in its label's colour (globals.css). Below 360px the New event
// pill is its "+" alone, still named.
export async function HostHeader({ host }: { host: Host }) {
  const [t, page, operator, atLimit] = await Promise.all([
    getTranslations("Host.header"),
    homePage(),
    isOperator(host.id),
    eventsOwnedAtLimit(host.id),
  ]);
  return (
    <header data-slot="host-header" className="h-16 border-b border-theme-glass-border bg-theme-glass-strong backdrop-blur-xl">
      <div className="mx-auto flex h-full w-full max-w-5xl items-center justify-between gap-3 px-4">
        {/* Cut short when long, which would clip an outline: its focus is a ring of its own. */}
        <Link
          href="/dashboard"
          className="min-w-0 truncate rounded-md text-lg font-semibold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {instanceDisplayName(page)}
        </Link>
        <nav className="flex shrink-0 items-center gap-2">
          {atLimit === undefined && (
            <Button asChild className="h-9 gap-1.5 rounded-full border-0 px-3 font-semibold min-[360px]:pr-4">
              <Link href="/events/new" aria-label={t("newEvent")}>
                <Plus aria-hidden className="size-4" />
                <span aria-hidden className="hidden min-[360px]:inline">
                  {t("newEvent")}
                </span>
              </Link>
            </Button>
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
