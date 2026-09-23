import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { cn } from "@/lib/utils";

// Every page's footer: the operator's privacy policy and terms of use (src/legal/). The root
// layout puts the plain one under every page. An event page wears its own theme, so it carries a
// footer of its own inside it, on the veil that keeps bare text readable on any background, and
// the plain one steps aside (the `themed` variant, globals.css). The links are rarely followed,
// so no page fetches them ahead.
export async function PageFooter({ themed = false }: { themed?: boolean }) {
  const t = await getTranslations("Footer");
  const link = "underline-offset-4 hover:underline";
  return (
    <footer className={cn("px-4 pt-2 pb-8", !themed && "themed:hidden")}>
      <p
        className={cn(
          "mx-auto flex w-fit gap-4",
          themed ? "rounded-full bg-theme-veil px-4 py-1.5 text-xs text-theme-text-muted backdrop-blur-xl" : "text-sm text-muted-foreground",
        )}
      >
        <Link href="/privacy" prefetch={false} className={link}>
          {t("privacy")}
        </Link>
        <Link href="/terms" prefetch={false} className={link}>
          {t("terms")}
        </Link>
      </p>
    </footer>
  );
}
