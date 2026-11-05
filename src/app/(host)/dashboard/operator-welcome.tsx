"use client";

import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { useState, type MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { dismissOperatorWelcomeAction } from "@/instance/actions";
import { DEFAULT_INSTANCE_NAME } from "@/instance/home";
import type { RegistrationMode } from "@/instance/registration";

// The operator's welcome (home page spec, "The operator's first visit"): a sheet from the foot of
// the screen below md and a centred dialog from md, in the dashboard's light look, saying the site
// is theirs and pointing at the three settings that matter first. It is a dialog as the editor's
// sheets are (editor/sheet.tsx): its heading has the focus as it opens, and Escape closes it, the
// focus going to the page's heading. Every
// way out of it, Escape and a tap outside included, counts as Not now, and following a row or
// Name your instance dismisses it too, so it shows once.
export function OperatorWelcome({
  poster,
  instanceName,
  mode,
  maxEventsPerHost,
  retentionDays,
}: {
  // A gallery poster's card file, as a decorative picture.
  poster: string;
  instanceName: string | null;
  mode: RegistrationMode;
  maxEventsPerHost: number;
  retentionDays: number | null;
}) {
  const t = useTranslations("Dashboard.operatorWelcome");
  const router = useRouter();
  const [open, setOpen] = useState(true);

  const dismiss = async () => {
    setOpen(false);
    await dismissOperatorWelcomeAction();
  };
  // Dismissing first, so that the sheet is gone for good before the page it points to opens.
  const goTo = (href: string) => async (event?: MouseEvent) => {
    event?.preventDefault();
    await dismiss();
    router.push(href);
  };

  const rows = [
    {
      href: "/instance#home-page",
      label: t("name.label"),
      value: instanceName === null ? t("name.notSet", { name: DEFAULT_INSTANCE_NAME }) : instanceName,
    },
    { href: "/instance#registration", label: t("signUp.label"), value: t(`signUp.${mode}`) },
    {
      href: "/instance#limits",
      label: t("limits.label"),
      value: retentionDays === null ? t("limits.keptForever", { events: maxEventsPerHost }) : t("limits.kept", { events: maxEventsPerHost, days: retentionDays }),
    },
  ];

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && void dismiss()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in" />
        <Dialog.Content
          data-slot="operator-welcome"
          // Nothing opened the sheet, so there is nothing to give the focus back to: it goes to the
          // page's own heading, where a person starts reading.
          onCloseAutoFocus={(event) => {
            const heading = document.querySelector<HTMLElement>("main h1");
            if (!heading) return;
            event.preventDefault();
            heading.focus();
          }}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            (event.currentTarget as HTMLElement).querySelector<HTMLElement>("[data-sheet-heading]")?.focus();
          }}
          className={
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col overflow-hidden rounded-t-3xl border-t bg-background text-foreground shadow-2xl outline-none " +
            "md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:max-h-[90dvh] md:w-[28rem] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl md:border " +
            "motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:slide-in-from-bottom motion-safe:md:data-[state=open]:slide-in-from-bottom-0 motion-safe:md:data-[state=open]:zoom-in-95"
          }
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- a card file already made to size */}
          <img src={poster} alt="" className="h-28 w-full shrink-0 object-cover md:h-36" />
          <div className="flex-1 overflow-y-auto overscroll-contain px-5 pt-5">
            <Dialog.Title data-sheet-heading tabIndex={-1} className="text-xl font-semibold tracking-tight outline-none">
              {t("title")}
            </Dialog.Title>
            <Dialog.Description className="mt-1.5 text-sm text-muted-foreground">{t("description")}</Dialog.Description>
            <ul className="mt-4 flex flex-col gap-2">
              {rows.map(({ href, label, value }) => (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={goTo(href)}
                    className="flex min-h-12 items-center justify-between gap-3 rounded-xl bg-card px-4 py-2.5 ring-1 ring-foreground/10 transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{label}</span>
                      <span className="block text-sm text-muted-foreground">{value}</span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col-reverse gap-2 px-5 pt-4 pb-[max(env(safe-area-inset-bottom),1.25rem)] sm:flex-row sm:justify-end">
            <Button variant="ghost" size="lg" onClick={() => void dismiss()}>
              {t("notNow")}
            </Button>
            <Button size="lg" onClick={() => void goTo("/instance#home-page")()}>
              {t("nameIt")}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
