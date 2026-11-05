import { LinkIcon, PenLine } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getSession } from "@/auth/session";
import { PageFooter } from "@/components/page-footer";
import { DEFAULT_HOME_PAGE, DEFAULT_INSTANCE_NAME, homeTheme, instanceDisplayName, pickPoster, posterPool, runBy } from "@/instance/home";
import { hasAccounts, homePage, operatorName, registrationMode } from "@/instance/repository";
import { cn } from "@/lib/utils";
import { Glass } from "@/themes/glass";
import { PinnedBar } from "@/themes/pinned-bar";
import { PosterHero } from "@/themes/poster-card";
import { entrance, HostLine, IconTile, invitationEntrance, SectionLabel } from "@/themes/poster-parts";
import { rsvpButtonClasses } from "@/themes/rsvp-buttons";
import { ThemedPage } from "@/themes/themed-page";

// The tab and a shared link name the instance and give its welcome line. A fresh instance has
// nobody's name to give yet.
export async function generateMetadata(): Promise<Metadata> {
  const [t, accounts, page] = await Promise.all([getTranslations("Home"), hasAccounts(), homePage()]);
  if (!accounts) return { title: DEFAULT_INSTANCE_NAME, description: t("defaultWelcome") };
  return { title: instanceDisplayName(page), description: page.welcomeLine ?? t("defaultWelcome") };
}

// The home page, the instance inviting a visitor in (home page spec, "What the home page shows"):
// laid out as an event page in the Poster layout, with a gallery poster drawn afresh on each visit,
// the instance's name as its title, the welcome line where an event's description would be, one
// card on how the site works, and the way in on the bar at the foot. A fresh instance, with no
// account yet, shows its setup version to whoever installed it; a host who is signed in goes to
// their events. The page reads the session, so it is drawn on every request: a change to the
// settings or the registration mode shows on the next visit.
export default async function Home() {
  if (await getSession()) redirect("/dashboard");
  const [t, accounts, page, mode] = await Promise.all([getTranslations("Home"), hasAccounts(), homePage(), registrationMode()]);
  // Until the first account exists nothing is configured: every gallery poster is in the draw.
  const fresh = !accounts;
  const theme = homeTheme(pickPoster(posterPool(fresh ? DEFAULT_HOME_PAGE : page)));
  const runner = fresh ? null : runBy(page.showOperator, page.showOperator ? await operatorName() : null);

  const primary = rsvpButtonClasses("solid", { selected: false });
  const secondary = rsvpButtonClasses("glass", { selected: false });
  const ways = fresh ? (
    <Link href="/sign-up" className={primary}>
      {t("fresh.button")}
    </Link>
  ) : mode === "open" ? (
    <>
      <Link href="/sign-up" className={primary}>
        {t("signUp")}
      </Link>
      <Link href="/sign-in" className={secondary}>
        {t("signIn")}
      </Link>
    </>
  ) : (
    <Link href="/sign-in" className={primary}>
      {t("signIn")}
    </Link>
  );

  return (
    <ThemedPage theme={theme}>
      <main className="mx-auto w-full max-w-[28rem] pb-8">
        <PosterHero title={fresh ? t("fresh.title") : instanceDisplayName(page)} className={cn(invitationEntrance, "motion-safe:delay-0")} />
        <p className={cn("mt-3 px-5 text-[1.0625rem] leading-relaxed text-theme-text-muted sm:px-6", entrance, "motion-safe:delay-100")}>
          {fresh ? t("fresh.text") : (page.welcomeLine ?? t("defaultWelcome"))}
        </p>
        {runner && (
          <HostLine name={runner} className={cn(entrance, "motion-safe:delay-100")}>
            {t("runBy", { name: runner })}
          </HostLine>
        )}

        {/* The bar is fixed to the foot of the screen; it is here for a screen reader and the
            keyboard, after the opening and before the card, as an event page's reply bar is. */}
        <PinnedBar slot="home-bar">
          <div className="flex gap-2 *:flex-1">{ways}</div>
        </PinnedBar>

        <div className="px-4 pt-5">
          <Glass data-slot="how" className={cn("rounded-[1.75rem] p-5", entrance, "motion-safe:delay-200")}>
            {fresh ? (
              <>
                <SectionLabel>{t("fresh.stepsTitle")}</SectionLabel>
                <ol className="flex flex-col gap-4">
                  {(["step1", "step2", "step3"] as const).map((step, index) => (
                    <Row key={step} tile={<span className="text-sm font-semibold">{index + 1}</span>} title={t(`fresh.${step}.title`)}>
                      {t(`fresh.${step}.text`)}
                    </Row>
                  ))}
                </ol>
              </>
            ) : (
              <>
                <SectionLabel>{t("how.title")}</SectionLabel>
                <ul className="flex flex-col gap-4">
                  <Row tile={<LinkIcon className="size-4.5" />} title={t("how.invitedTitle")}>
                    {t("how.invitedText")}
                  </Row>
                  <Row tile={<PenLine className="size-4.5" />} title={t("how.hostingTitle")}>
                    {t(mode === "open" ? "how.hostingOpen" : "how.hostingInvitationOnly")}
                  </Row>
                </ul>
              </>
            )}
          </Glass>
        </div>
      </main>
      <PageFooter themed poweredBy />
    </ThemedPage>
  );
}

// One row of the card: its icon, or its number in a list of steps, in the tile the details' rows
// use, then what it is about and what it says.
function Row({ tile, title, children }: { tile: ReactNode; title: string; children: ReactNode }) {
  return (
    <li className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-3">
      <IconTile>{tile}</IconTile>
      <div className="min-w-0 pt-0.5">
        <h3 className="text-base leading-snug font-medium">{title}</h3>
        <p className="mt-0.5 text-sm leading-relaxed text-theme-text-muted">{children}</p>
      </div>
    </li>
  );
}
