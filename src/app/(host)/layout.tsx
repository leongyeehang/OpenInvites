import type { ReactNode } from "react";
import { requireHost } from "@/auth/session";

// The host area's guard: a signed-out visitor is sent to sign in. The frame is drawn by the layouts
// below it, (own) for the host's own pages and events/[id] for an event's, which wear different
// looks. Pages call requireHost() themselves too.
export default async function HostLayout({ children }: { children: ReactNode }) {
  await requireHost();
  return children;
}
