import type { ReactNode } from "react";
import { requireHost } from "@/auth/session";
import { hostLook } from "@/dashboard/host-look";
import { Glass } from "@/themes/glass";
import { HostFrame } from "../../host-frame";

// An event's management pages (guests, invites, share, hosts, announcements) in the frame of every
// signed-in page. A stopgap until ticket 21, which replaces it with the event's own Theme and proper
// panels: until then they wear the host's look, and the whole page sits in one glass panel, so that
// none of their text is on the bare backdrop (a card or row in it is glass on glass, which
// legibility.ts proves as SITE_SURFACES.nested).
export default async function EventPagesLayout({ children }: { children: ReactNode }) {
  const host = await requireHost();
  return (
    <HostFrame host={host} look={await hostLook(host.id)}>
      <Glass className="flex flex-col gap-8 p-5 md:p-6">{children}</Glass>
    </HostFrame>
  );
}
