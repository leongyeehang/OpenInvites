"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { useTheme } from "../themed-page";

const PIECES = 56;

// The accent, the page's text colour, and the accent lightened halfway to white, as the page
// wears them now.
const COLOURS = ["var(--theme-accent)", "var(--theme-text)", "color-mix(in oklab, var(--theme-accent), white 50%)"];

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeToMotion(onChange: () => void) {
  const query = matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

// Whether the guest's device asks for reduced motion. Only the browser knows, and confetti only
// ever mounts there; the server's answer, never used, is the still one.
function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeToMotion,
    () => matchMedia(REDUCED_MOTION).matches,
    () => true,
  );
}

// The Confetti effect (PROTOTYPE.md, "Effect"): pieces fall once from above the top of the screen,
// over about three seconds, drifting and turning as they go, over everything on the page, and
// are gone from it once they have all landed. The RSVP flow mounts it, with a fresh key each time
// an answer makes a guest Going (trigger.ts). It is put in the page's own element, so the pieces
// wear the theme's colours, fixed to the screen whatever the flow sits in. Under reduced motion
// it is nothing at all.
export function Confetti() {
  const reduced = useReducedMotion();
  const { root } = useTheme();
  const layer = useRef<HTMLDivElement>(null);
  const [landed, setLanded] = useState(false);

  // Each piece is given its size, where it starts and how it falls here, in the browser, as it
  // starts to fall.
  useEffect(() => {
    const pieces = [...(layer.current?.children ?? [])] as HTMLElement[];
    if (pieces.length === 0) return;
    const falls = pieces.map((piece, index) => {
      const width = 6 + Math.random() * 6;
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.width = `${width}px`;
      piece.style.height = `${index % 4 === 0 ? width : 10 + Math.random() * 10}px`;
      const drift = (Math.random() - 0.5) * 120;
      const turn = Math.random() * 720 - 360;
      return piece.animate(
        [
          { transform: "translate(0, 0) rotate(0deg)", opacity: 1 },
          { transform: `translate(${drift}px, 57vh) rotate(${turn / 2}deg)`, offset: 0.5 },
          { opacity: 1, offset: 0.75 },
          { transform: `translate(${drift * 0.4}px, 115vh) rotate(${turn}deg)`, opacity: 0 },
        ],
        { duration: 2000 + Math.random() * 1400, delay: Math.random() * 500, easing: "cubic-bezier(0.3, 0.6, 0.6, 1)", fill: "both" },
      );
    });
    let stopped = false;
    Promise.all(falls.map((fall) => fall.finished)).then(
      () => !stopped && setLanded(true),
      // Stopped part-way, below: nothing is left to take away.
      () => undefined,
    );
    return () => {
      stopped = true;
      falls.forEach((fall) => fall.cancel());
    };
  }, [reduced, root]);

  if (reduced || landed || !root) return null;
  return createPortal(
    <div ref={layer} aria-hidden data-effect="confetti" className="pointer-events-none fixed inset-0 z-70 overflow-hidden">
      {Array.from({ length: PIECES }, (_, index) => (
        <span key={index} className={cn("absolute -top-[6%] block", index % 4 === 0 ? "rounded-full" : "rounded-[2px]")} style={{ background: COLOURS[index % 3] }} />
      ))}
    </div>,
    root,
  );
}
