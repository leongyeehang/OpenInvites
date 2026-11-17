import type { CSSProperties, ReactNode } from "react";
import { PageFooter } from "@/components/page-footer";
import type { SiteLook } from "@/instance/site-look";
import { cn } from "@/lib/utils";
import { Backdrop } from "./backdrop";
import { resolveTheme, themeVariables } from "./resolve";
import { TITLE_FONT_CLASSES } from "./title-fonts";

// The root of every page that is not an event page (M8 spec, "Glass", "SitePage"): the look the page
// wears (instance/site-look.ts) painted as the event page paints its theme, solved for a site page
// (legibility.ts, SITE_SURFACES), on the backdrop held still, with the themed footer. The scope in
// globals.css ("Site pages") points shadcn's tokens at the glass, so its cards, fields, alerts and
// buttons read on it without a change of their own. Under light text it is `dark` too, so that
// shadcn's dark variants, which are made for light text, apply. It is drawn on the server and holds
// no state: ThemedPage's context and optimistic theme are the event page's alone.
export function SitePage({ look, children }: { look: SiteLook; children: ReactNode }) {
  const resolved = resolveTheme(look.theme, look.upload, "site");
  const tone = resolved.textTone;
  return (
    <div
      data-slot="site-page"
      data-tone={tone}
      // No background of its own: a positioned box would paint over the fixed backdrop below.
      className={cn("site-page relative flex min-h-dvh flex-col font-sans text-theme-text", tone === "light" && "dark", TITLE_FONT_CLASSES[resolved.font.key])}
      style={themeVariables(resolved) as CSSProperties}
    >
      <Backdrop theme={resolved} effect="none" still />
      {children}
      <PageFooter themed />
    </div>
  );
}
