import type { ReactNode } from "react";
import Link from "next/link";
import { instanceDisplayName, posterPool } from "@/instance/home";
import { homePage } from "@/instance/repository";
import { areaLook } from "@/instance/site-look";
import { Veil } from "@/themes/glass";
import { SitePage } from "@/themes/site-page";

// One narrow column for every screen a person sees before or without being signed in. It wears the
// welcome area's poster from the site's set (M8 spec, "Glass", "Which poster"), so that the site
// keeps its character the moment a visitor presses Sign in, with the site's name above the cards
// leading home. The screens' cards, alerts, fields and buttons are shadcn's, which the site page's
// scope makes glass (globals.css, "Site pages").
export default async function AuthLayout({ children }: { children: ReactNode }) {
  const page = await homePage();
  return (
    <SitePage look={areaLook(posterPool(page), "welcome")}>
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
        <Veil>
          <Link href="/" data-slot="site-name" className="block rounded-md text-lg font-semibold tracking-tight break-words">
            {instanceDisplayName(page)}
          </Link>
        </Veil>
        {children}
      </main>
    </SitePage>
  );
}
