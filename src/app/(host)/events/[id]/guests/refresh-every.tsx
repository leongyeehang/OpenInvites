"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Often enough that a reply arriving mid-sentence feels live, seldom enough to be nothing.
const EVERY_MS = 5_000;

// The host's guest list updates while they watch it (spec, story 55). Polling, which the spec
// offers as an alternative to a server-sent stream and which is by far the simpler of the two.
export function RefreshWhileWatching() {
  const router = useRouter();
  useEffect(() => {
    const tick = setInterval(() => router.refresh(), EVERY_MS);
    return () => clearInterval(tick);
  }, [router]);
  return null;
}
