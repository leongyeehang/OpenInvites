"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Often enough that a clip turning ready feels live, seldom enough to be nothing. The guests
// page's RefreshWhileWatching does the same for replies.
const EVERY_MS = 5_000;

// Mounted while the album shows an item in processing (M7 ticket 07; plan ruling 19): the page is
// server-drawn and nothing else re-reads it. router.refresh() keeps the client's state, the open
// viewer included, which follows its item by id wherever a refresh moves it. Mounted only on the
// pages of those who see the item processing, its uploader's and the hosts', since each refresh is
// a visit the event page limit counts (media part review). Its mark, hidden, says in the page's
// HTML that the page refreshes.
export function RefreshWhileProcessing() {
  const router = useRouter();
  useEffect(() => {
    const tick = setInterval(() => router.refresh(), EVERY_MS);
    return () => clearInterval(tick);
  }, [router]);
  return <span hidden data-slot="refresh-while-processing" />;
}
