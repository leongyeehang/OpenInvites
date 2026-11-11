"use client";

import { CircleDot } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { LivePhoto } from "./album";
import { useReducedMotion } from "../use-reduced-motion";

// How long a press must last, and how little it may move, to be a hold rather than a tap or a swipe.
const HOLD_MS = 300;
const HOLD_SLOP_PX = 10;

// A live photo in the viewer (M8 ticket 08): the still, and over it the motion, muted, shown only
// while it plays. Held (a press of HOLD_MS that moves less than HOLD_SLOP_PX) it plays until let
// go, cancelled or left, and a swipe still turns the page; its Live mark, in the picture's corner,
// is a button that plays it once from the start and back to the still at its end, or stops it.
// Nothing plays by itself, nor when the viewer opens or turns, which mounts this anew; under
// reduced motion the hold is off and only the button plays it. A hold also ends when the window
// loses focus or the page is hidden, where the lifted pointer would never be heard. The picture is
// sized by the viewer's area (a size container), so the mark sits on the picture, not the
// letterbox.
export function LivePicture({ photo, alt }: { photo: LivePhoto; alt: string }) {
  const t = useTranslations("EventPage.album");
  const reduced = useReducedMotion();
  const motion = useRef<HTMLVideoElement>(null);
  const hold = useRef<{ x: number; y: number; timer: number; on: boolean } | undefined>(undefined);
  // Each play and stop counts, so a play cut short by a stop does not stop the play after it.
  const runs = useRef(0);
  const [playing, setPlaying] = useState<"once" | "held">();
  const [shown, setShown] = useState(false);

  useEffect(() => () => window.clearTimeout(hold.current?.timer), []);

  const stop = () => {
    runs.current += 1;
    motion.current?.pause();
    setPlaying(undefined);
    setShown(false);
  };
  const play = (how: "once" | "held") => {
    const video = motion.current;
    if (!video) return;
    const run = (runs.current += 1);
    video.currentTime = 0;
    setPlaying(how);
    video.play().catch(() => runs.current === run && stop());
  };
  const release = () => {
    const held = hold.current;
    if (!held) return;
    window.clearTimeout(held.timer);
    hold.current = undefined;
    if (held.on) stop();
  };
  const lost = useEffectEvent(() => release());
  useEffect(() => {
    const blurred = () => lost();
    const hidden = () => document.visibilityState === "hidden" && lost();
    window.addEventListener("blur", blurred);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("blur", blurred);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, []);

  return (
    <div
      data-hold={reduced ? "off" : "on"}
      onPointerDown={(event) => {
        if (reduced || event.button !== 0 || (event.target as HTMLElement).closest("button")) return;
        release();
        const timer = window.setTimeout(() => {
          if (!hold.current) return;
          hold.current.on = true;
          play("held");
        }, HOLD_MS);
        hold.current = { x: event.clientX, y: event.clientY, timer, on: false };
      }}
      onPointerMove={(event) => {
        const held = hold.current;
        if (!held || held.on || Math.hypot(event.clientX - held.x, event.clientY - held.y) < HOLD_SLOP_PX) return;
        window.clearTimeout(held.timer);
        hold.current = undefined;
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={release}
      // During a hold only: Android's long press would otherwise open the picture's menu and end
      // it. Any other time the menu is the browser's, so a right-click still saves the picture.
      onContextMenu={(event) => {
        if (hold.current) event.preventDefault();
      }}
      className="relative select-none [-webkit-touch-callout:none]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- served whole from the uploads route, already sized */}
      <img src={photo.large} alt={alt} width={photo.width} height={photo.height} className="block h-auto max-h-[100cqh] w-auto max-w-[100cqw] object-contain" draggable={false} />
      <video
        ref={motion}
        data-slot="live-motion"
        src={photo.motion}
        muted
        playsInline
        preload="none"
        loop={playing === "held"}
        onPlaying={() => setShown(true)}
        onEnded={stop}
        aria-hidden
        className={cn("pointer-events-none absolute inset-0 size-full object-contain", !shown && "invisible")}
      />
      <button
        type="button"
        data-slot="live-mark"
        aria-label={t("playLive")}
        aria-pressed={playing !== undefined}
        onClick={() => (playing ? stop() : play("once"))}
        className="absolute top-2 left-2 inline-flex h-8 cursor-pointer items-center gap-1 rounded-full bg-black/50 px-2.5 text-xs font-medium text-white hover:bg-black/70 focus-visible:outline-2 focus-visible:outline-white aria-pressed:bg-white aria-pressed:text-black"
      >
        <CircleDot className="size-3.5" aria-hidden />
        {t("live")}
      </button>
    </div>
  );
}
