"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Often enough that a clip turning ready feels live, seldom enough to be nothing. The guests
// page's RefreshWhileWatching does the same for replies.
const EVERY_MS = 5_000;

// Mounted while the album shows an item in processing (M7 ticket 07; plan ruling 19): the page is
// server-drawn and nothing else re-reads it. router.refresh() keeps the client's state, the open
// viewer included, and items are ordered oldest first, so what is open stays where it is.
export function RefreshWhileProcessing() {
  const router = useRouter();
  useEffect(() => {
    const tick = setInterval(() => router.refresh(), EVERY_MS);
    return () => clearInterval(tick);
  }, [router]);
  return null;
}
