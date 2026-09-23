import type { ReactNode } from "react";
import { requireHost } from "@/auth/session";
import { hostNeedsVerification } from "@/auth/verification";
import { HostHeader } from "./host-header";
import { VerificationBanner } from "./verification-banner";

// The host area: a header with the host's display name on every page. Pages call
// requireHost() themselves too; this layout is for the header, not the guard.
export default async function HostLayout({ children }: { children: ReactNode }) {
  const host = await requireHost();
  return (
    <>
      <HostHeader host={host} />
      {hostNeedsVerification(host) && <VerificationBanner email={host.email} />}
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8">{children}</main>
    </>
  );
}
