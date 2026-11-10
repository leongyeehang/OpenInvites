"use client";

import { useTranslations } from "next-intl";
import { useId, useRef, useState, useSyncExternalStore } from "react";
import { chooseQuality, playable, type PlayQuality } from "@/album/video";

// The album's video player (M7 ticket 07): the browser's own, the poster first, seeking through
// the uploads route's byte ranges. Original quality and the lighter copy are offered when both
// exist; the viewer's choice is kept on the device for every video on the site (the maintainer,
// 2026-11-09), read through an external store with a server snapshot, so the server's and the
// browser's first drawing agree. An original the browser cannot decode (an iPhone's HEVC on many
// computers) gives way to the copy and says so; with no copy either, the viewer is told to
// download it. Switching keeps the position and whether it was playing.

const CHOICE = "openinvites.videoQuality";

export type PlayableVideo = { original: string; copy: string | null; poster: string; codec: string; width: number; height: number };

function storedChoice(): PlayQuality | undefined {
  try {
    const value = localStorage.getItem(CHOICE);
    return value === "original" || value === "copy" ? value : undefined;
  } catch {
    return undefined;
  }
}

function subscribeToStorage(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

const noSubscription = () => () => undefined;

// Whether this browser plays a codec, asked once per codec: the answer never changes.
const answers = new Map<string, boolean>();
function canPlay(codec: string): boolean {
  let answer = answers.get(codec);
  if (answer === undefined) {
    answer = playable(codec, (type) => document.createElement("video").canPlayType(type));
    answers.set(codec, answer);
  }
  return answer;
}

export function VideoPlayer({ video, label }: { video: PlayableVideo; label: string }) {
  const t = useTranslations("EventPage.album");
  const id = useId();
  const element = useRef<HTMLVideoElement>(null);
  const resume = useRef<{ at: number; paused: boolean }>(undefined);
  // The device's choice before this page, and the one made on it, which wins.
  const kept = useSyncExternalStore(subscribeToStorage, storedChoice, () => undefined);
  const [chosen, setChosen] = useState<PlayQuality>();
  const originalPlayable = useSyncExternalStore(noSubscription, () => canPlay(video.codec), () => true);
  const hasCopy = video.copy !== null;
  const quality = chooseQuality(chosen ?? kept, originalPlayable, hasCopy);
  const src = quality === "copy" && video.copy ? video.copy : video.original;

  const choose = (next: PlayQuality) => {
    const player = element.current;
    resume.current = { at: player?.currentTime ?? 0, paused: player?.paused ?? true };
    try {
      localStorage.setItem(CHOICE, next);
    } catch {
      // Private windows and blocked storage: the choice lasts for this page.
    }
    setChosen(next);
  };

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-2">
      {!hasCopy && !originalPlayable && <p className="text-sm text-white/80">{t("unplayable")}</p>}
      <video
        key={src}
        ref={element}
        src={src}
        controls
        playsInline
        preload="metadata"
        poster={video.poster}
        aria-label={label}
        width={video.width || undefined}
        height={video.height || undefined}
        onLoadedMetadata={(event) => {
          const from = resume.current;
          if (!from) return;
          resume.current = undefined;
          event.currentTarget.currentTime = from.at;
          if (!from.paused) void event.currentTarget.play().catch(() => undefined);
        }}
        className="max-h-full max-w-full"
      />
      {hasCopy && (
        <>
          <div role="radiogroup" aria-label={t("quality")} className="flex gap-1 rounded-full bg-white/10 p-1 text-xs">
            {(["copy", "original"] as const).map((choice) => (
              <button
                key={choice}
                type="button"
                role="radio"
                aria-checked={quality === choice}
                aria-describedby={choice === "original" && !originalPlayable ? `${id}-unplayable` : undefined}
                disabled={choice === "original" && !originalPlayable}
                onClick={() => choose(choice)}
                className="cursor-pointer rounded-full px-3 py-1 aria-checked:bg-white/90 aria-checked:text-black hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
              >
                {t(choice)}
              </button>
            ))}
          </div>
          {!originalPlayable && (
            <p id={`${id}-unplayable`} className="text-xs text-white/70">
              {t("originalUnplayable")}
            </p>
          )}
        </>
      )}
    </div>
  );
}
