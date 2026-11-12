import type { ReactNode } from "react";
import { requireHost } from "@/auth/session";
import { hostLook } from "@/dashboard/host-look";
import { HostFrame } from "../host-frame";

// A host's own pages, the dashboard, Account and New event, in one frame wearing the host's look
// (M8 ticket 20). A layout is not drawn again as the host moves between the pages under it, so the
// look stays put across them, as one area's should.
export default async function OwnLayout({ children }: { children: ReactNode }) {
  const host = await requireHost();
  return (
    <HostFrame host={host} look={await hostLook(host.id)}>
      {children}
    </HostFrame>
  );
}
