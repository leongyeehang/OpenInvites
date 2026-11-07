"use client";

import { DropdownMenu } from "radix-ui";
import Link from "next/link";
import { useId, useRef } from "react";
import { signOut } from "@/auth/actions";

// The host's initials in the header, opening the account menu (dashboard spec, "The frame of every
// signed-in page"): who is signed in, their account, the site's settings for the operator alone,
// and signing out. Radix gives it its keys: Enter or Space opens it, the arrows move, Escape closes
// it and hands the focus back to the initials. It is not modal, so the page behind is not hidden
// from a screen reader while the initials, which stay focusable, are in it. Choosing Sign out
// submits a form outside the menu, which is gone by the time a form inside it would be sent. The
// menu is named by who is signed in, so a screen reader says whose it is as it opens. Until the
// script has run, or where it never does, the initials are a plain link to the Account page, which
// has Sign out too; once it has, a click opens the menu instead. Its words come from the header, on
// the server.
export function AccountMenu({
  initials,
  name,
  email,
  siteSettings,
  labels,
}: {
  initials: string;
  name: string;
  email: string;
  siteSettings: boolean;
  labels: { menu: string; account: string; siteSettings: string; signOut: string };
}) {
  const signOutForm = useRef<HTMLFormElement>(null);
  const who = useId();
  const item =
    "flex w-full cursor-pointer items-center rounded-lg px-3 py-2 text-left text-sm outline-none select-none data-highlighted:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50";
  return (
    <>
      <form ref={signOutForm} action={signOut} hidden />
      <DropdownMenu.Root modal={false}>
        <DropdownMenu.Trigger asChild>
          <Link
            href="/account"
            role="button"
            aria-label={labels.menu}
            onClick={(event) => event.preventDefault()}
            className="grid size-9 shrink-0 place-items-center rounded-full bg-card text-xs font-semibold text-foreground shadow-sm ring-1 ring-foreground/10 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span aria-hidden>{initials}</span>
          </Link>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            aria-labelledby={who}
            align="end"
            sideOffset={8}
            className="z-50 flex w-64 flex-col rounded-2xl bg-popover p-1.5 text-popover-foreground shadow-lg ring-1 ring-foreground/10"
          >
            <div id={who} className="flex min-w-0 flex-col px-3 pt-2 pb-2.5">
              <span className="truncate text-sm font-semibold">{name}</span>
              <span className="truncate text-sm text-muted-foreground">{email}</span>
            </div>
            <DropdownMenu.Separator className="mx-1 mb-1 h-px bg-border" />
            <DropdownMenu.Item asChild className={item}>
              <Link href="/account">{labels.account}</Link>
            </DropdownMenu.Item>
            {siteSettings && (
              <DropdownMenu.Item asChild className={item}>
                <Link href="/instance">{labels.siteSettings}</Link>
              </DropdownMenu.Item>
            )}
            <DropdownMenu.Separator className="mx-1 my-1 h-px bg-border" />
            <DropdownMenu.Item className={item} onSelect={() => signOutForm.current?.requestSubmit()}>
              {labels.signOut}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </>
  );
}
