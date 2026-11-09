"use client";

import { useSyncExternalStore } from "react";

// The guest's clock, in half-minute steps so the snapshot holds still between ticks and a
// countdown in minutes stays honest.
const TICK_MS = 30_000;

function subscribeToClock(onChange: () => void) {
  const tick = setInterval(onChange, TICK_MS);
  return () => clearInterval(tick);
}

const onTheDevice = () => Math.floor(Date.now() / TICK_MS) * TICK_MS;

// Without `serverNow`, the clock reads as nothing on the server and in the first client render, so
// the two agree, and fills in once the browser has answered (the countdown). Given the server's
// time, the page is drawn by it on the server and in the first client render, so the two still
// agree, and the device's own clock takes over at once after (the schedule).
export function useClock(): Date | null;
export function useClock(serverNow: Date): Date;
export function useClock(serverNow?: Date): Date | null {
  const at = useSyncExternalStore(subscribeToClock, onTheDevice, () => serverNow?.getTime() ?? null);
  return at === null ? null : new Date(at);
}
