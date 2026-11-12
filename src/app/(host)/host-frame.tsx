import type { ReactNode } from "react";
import type { Host } from "@/auth/session";
import { hostNeedsVerification } from "@/auth/verification";
import type { SiteLook } from "@/instance/site-look";
import { SitePage } from "@/themes/site-page";
import { HostHeader } from "./host-header";
import { VerificationBanner } from "./verification-banner";

// The frame of every signed-in page (dashboard spec, "The frame of every signed-in page"; M8 spec,
// "Glass"): a still poster behind, the header as a bar of glass, the verification banner until the
// host has verified their email, the page, and the themed footer. The dashboard alone is wider, for
// its shelves. The look is the page's to choose: a host's own pages wear theirs (hostLook), Site
// settings and reports the site area's.
export async function HostFrame({ host, look, children }: { host: Host; look: SiteLook; children: ReactNode }) {
  return (
    <SitePage look={look}>
      <HostHeader host={host} />
      {hostNeedsVerification(host) && <VerificationBanner email={host.email} />}
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-8 has-data-[slot=dashboard]:max-w-5xl">{children}</main>
    </SitePage>
  );
}
