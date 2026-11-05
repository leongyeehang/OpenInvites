import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { SOURCE_URL } from "@/instance/source";
import { cn } from "@/lib/utils";
import { LocaleSwitcher } from "@/locale/locale-switcher";

// Every page's footer: the operator's privacy policy and terms of use (src/legal/), and the
// language switcher. The root layout puts the plain one under every page. An event page wears its
// own theme, so it carries a footer of its own inside it, on the veil that keeps bare text
// readable on any background, and the plain one steps aside (the `themed` variant, globals.css).
// An event page that can be reported (published or cancelled) passes its path as `reportPath`, and
// the footer offers "Report this event" there, in every layout. The home page passes `poweredBy`,
// and its footer begins with "Powered by OpenInvites", a link to the source (home page spec, "What
// the home page shows"), on a line of its own so that the row under it still fits a phone. The
// links are rarely followed, so no page fetches them ahead.
export async function PageFooter({ themed = false, reportPath, poweredBy = false }: { themed?: boolean; reportPath?: string; poweredBy?: boolean }) {
  const [t, home] = await Promise.all([getTranslations("Footer"), getTranslations("Home")]);
  const link = "underline-offset-4 hover:underline";
  const row = cn(
    "w-fit",
    themed ? "rounded-full bg-theme-veil px-4 py-1.5 text-xs text-theme-text-muted backdrop-blur-xl" : "text-sm text-muted-foreground",
  );
  return (
    <footer className={cn("flex flex-col items-center gap-2 px-4 pt-2 pb-8", !themed && "themed:hidden")}>
      {poweredBy && (
        <p className={row}>
          <a href={SOURCE_URL} className={link}>
            {home("poweredBy")}
          </a>
        </p>
      )}
      <p className={cn("flex gap-4", row)}>
        <Link href="/privacy" prefetch={false} className={link}>
          {t("privacy")}
        </Link>
        <Link href="/terms" prefetch={false} className={link}>
          {t("terms")}
        </Link>
        {reportPath && (
          <Link href={`${reportPath}/report`} prefetch={false} className={link}>
            {t("report")}
          </Link>
        )}
      </p>
      <LocaleSwitcher className={row} currentClassName={themed ? "text-theme-text" : "text-foreground"} />
    </footer>
  );
}
