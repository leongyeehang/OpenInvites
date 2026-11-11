"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  autoSize,
  endWait,
  formatPick,
  OLD_PICK_KEY,
  PICK_KEY,
  pickedSize,
  playable,
  readPick,
  recentWaits,
  shouldStepDown,
  sizeLabel,
  stepDown,
  type Connection,
  type SizePick,
  type VideoSize,
  type Wait,
} from "@/album/video";

// The album's video player (M7 ticket 07; sizes M8 ticket 06): the browser's own, the poster
// first, seeking through the uploads route's byte ranges. A video with two or more sizes offers
// them by name: Auto, the original under its real size, then the copies, largest first. Auto picks
// once, when the video opens, for the screen and the connection, and steps down one size when
// playback stalls; it never steps up within a video. A size the guest picks is kept on the device
// for every video on the site, read through an external store with a server snapshot, so the
// server's and the browser's first drawing agree. An original the browser cannot decode (an
// iPhone's HEVC on many computers) is offered disabled and says why; with no copy either, the
// viewer is told to download it. Switching keeps the position and whether it was playing.

// One size with its file.
export type ShownSize = VideoSize & { src: string };

export type PlayableVideo = { original: string; sizes: ShownSize[]; hdr: boolean; poster: string; codec: string; width: number; height: number };

function stored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

const storedPick = () => stored(PICK_KEY);
const storedOldPick = () => stored(OLD_PICK_KEY);

function subscribeToStorage(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

const noSubscription = () => () => undefined;

// A pick made on this page. Each video has a player of its own, so the pick lives here, where the
// next video finds it even when the browser refuses storage.
let pickedHere: SizePick | undefined;

function keepPick(pick: SizePick) {
  pickedHere = pick;
  try {
    localStorage.setItem(PICK_KEY, formatPick(pick));
  } catch {
    // Private windows and blocked storage: the pick lasts for this page.
  }
}

// M7's choice of quality, read once: written under the new key as the pick it means, then gone.
function moveOldPick() {
  try {
    const old = localStorage.getItem(OLD_PICK_KEY);
    if (old === null || localStorage.getItem(PICK_KEY) !== null) return;
    const pick = readPick(null, old);
    if (pick) localStorage.setItem(PICK_KEY, formatPick(pick));
    localStorage.removeItem(OLD_PICK_KEY);
  } catch {
    // Blocked storage: the old key is read as it is, and left.
  }
}

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

// Auto's size as the video opens: for this screen in device pixels and, where the browser reports
// it (not Firefox or Safari), the connection.
function autoAtOpen(video: PlayableVideo): ShownSize | undefined {
  if (typeof window === "undefined") return undefined;
  const plays = video.sizes.filter((size) => !size.original || canPlay(video.codec));
  const net = (navigator as Navigator & { connection?: Connection }).connection;
  // A ready video always has its width and height; a 0 would make Auto pick the smallest size.
  return autoSize(plays, video, { width: screen.width, height: screen.height, pixelRatio: window.devicePixelRatio || 1 }, net);
}

// A stall: a wait for data that lasts six seconds is checked once it has. Waits are timed on the
// page's monotonic clock, read only from the player's events and the checks they set; each wait
// keeps the timer of its check, so the two go together.
const LONG_WAIT_MS = 6000;
const clock = () => performance.now();
type TimedWait = Wait & { check: number };

export function VideoPlayer({ video, label }: { video: PlayableVideo; label: string }) {
  const t = useTranslations("EventPage.album");
  const id = useId();
  const element = useRef<HTMLVideoElement>(null);
  const resume = useRef<{ at: number; paused: boolean }>(undefined);
  // The device's pick before this page, and the one made on it, which wins.
  const kept = useSyncExternalStore(subscribeToStorage, storedPick, () => null);
  const keptOld = useSyncExternalStore(subscribeToStorage, storedOldPick, () => null);
  const [chosen, setChosen] = useState<SizePick | undefined>(() => pickedHere);
  const originalPlayable = useSyncExternalStore(noSubscription, () => canPlay(video.codec), () => true);
  const plays = (size: VideoSize) => !size.original || originalPlayable;
  // Auto's size, picked once for this video; only a step-down changes it.
  const [auto, setAuto] = useState(() => autoAtOpen(video));
  const pick = chosen ?? readPick(kept, keptOld);
  const picked = pick !== undefined && pick !== "auto" ? pickedSize(video.sizes, pick, plays) : undefined;
  const onAuto = picked === undefined;
  const played = picked ?? auto;
  const src = played?.src ?? video.original;

  useEffect(moveOldPick, []);

  // The waits for data under Auto, each with its check of a long wait, and whether a seek is under
  // way (its wait is no stall).
  const waits = useRef<TimedWait[]>([]);
  const seeking = useRef(false);
  useEffect(() => {
    const pending = waits;
    return () => pending.current.forEach((wait) => window.clearTimeout(wait.check));
  }, []);

  const forgetWaits = () => {
    waits.current.forEach((wait) => window.clearTimeout(wait.check));
    waits.current = [];
  };

  const holdPosition = () => {
    const player = element.current;
    resume.current = { at: player?.currentTime ?? 0, paused: player?.paused ?? true };
  };

  const choose = (next: SizePick) => {
    holdPosition();
    forgetWaits();
    keepPick(next);
    setChosen(next);
  };

  // Auto steps down one size, at the same position; nothing is kept on the device. The size it
  // steps from is read from a ref, so a check set before the last step never steps from a size
  // already left.
  const autoNow = useRef(auto);
  const stepIfStalling = () => {
    const from = autoNow.current;
    if (!from || !shouldStepDown(waits.current, clock())) return;
    const next = stepDown(video.sizes.filter(plays), from);
    forgetWaits();
    if (!next) return;
    holdPosition();
    autoNow.current = next;
    setAuto(next);
  };

  // Playing again, a pause or the source emptied ends the wait under way, so a guest who pauses
  // during a stall is not stepped down six seconds later (video.ts, endWait).
  const endWaits = () => {
    waits.current = endWait(waits.current, clock());
  };

  // A wait begins, closing one still open; waits no rule counts any longer go, with their checks.
  const beginWait = () => {
    if (!onAuto || seeking.current) return;
    const now = clock();
    const kept = recentWaits(endWait(waits.current, now), now);
    const keptChecks = new Set(kept.map((wait) => wait.check));
    for (const wait of waits.current) if (!keptChecks.has(wait.check)) window.clearTimeout(wait.check);
    waits.current = [...kept, { at: now, check: window.setTimeout(stepIfStalling, LONG_WAIT_MS) }];
    stepIfStalling();
  };

  type Option = { key: string; pick: SizePick; size?: ShownSize; label: ReactNode };
  const options: Option[] = [
    { key: "auto", pick: "auto", label: t("sizeAuto", { size: auto ? sizeLabel(auto.side) : "" }) },
    ...video.sizes.map((size, at) => {
      const name = sizeLabel(size.side);
      const label = !size.original
        ? name
        : video.hdr
          ? t.rich("sizeOriginalHdr", { size: name, hdr: (chunks) => <span className="inline-block rounded-sm border border-current px-1 text-[10px] leading-snug font-semibold">{chunks}</span> })
          : t("sizeOriginal", { size: name });
      return { key: String(at), pick: { side: size.side, original: size.original }, size, label };
    }),
  ];
  const checked = (option: Option) => (option.size ? option.size === picked : onAuto);
  const originalOut = !originalPlayable && video.sizes.some((size) => size.original);

  // The radio group's keys (M7 ticket 11): Tab reaches the size played, and an arrow moves to the
  // next and chooses it, as a radio group's arrows do; a size that cannot play is passed over.
  const move = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const radios = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]:not(:disabled)')];
    const at = radios.findIndex((radio) => radio === document.activeElement);
    const next = radios[(at + (event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1) + radios.length) % radios.length];
    if (!next) return;
    next.focus();
    const option = options.find(({ key }) => key === next.dataset.choice);
    if (option) choose(option.pick);
  };

  // The player fills the viewer's height, and the video gives way to the sizes under it, so a
  // 1080p video on a laptop's screen leaves them in view.
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-2 self-stretch">
      {!originalPlayable && !video.sizes.some((size) => !size.original) && <p className="text-sm text-white/80">{t("unplayable")}</p>}
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
        onSeeking={() => {
          seeking.current = true;
        }}
        onSeeked={() => {
          seeking.current = false;
        }}
        onWaiting={beginWait}
        onPlaying={endWaits}
        onPause={endWaits}
        onEmptied={endWaits}
        className="min-h-0 max-w-full"
      />
      {video.sizes.length >= 2 && (
        <>
          <div role="radiogroup" data-slot="video-sizes" aria-label={t("sizes")} onKeyDown={move} className="flex max-w-full flex-wrap justify-center gap-1 rounded-3xl bg-white/10 p-1 text-xs">
            {options.map((option) => (
              <button
                key={option.key}
                type="button"
                role="radio"
                data-choice={option.key}
                tabIndex={checked(option) ? 0 : -1}
                aria-checked={checked(option)}
                aria-describedby={option.size?.original && originalOut ? `${id}-unplayable` : undefined}
                disabled={option.size !== undefined && !plays(option.size)}
                onClick={() => choose(option.pick)}
                className="cursor-pointer rounded-full px-3 py-1 aria-checked:bg-white/90 aria-checked:text-black hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
              >
                {option.label}
              </button>
            ))}
          </div>
          {originalOut && (
            <p id={`${id}-unplayable`} className="text-xs text-white/70">
              {t("originalUnplayable")}
            </p>
          )}
        </>
      )}
    </div>
  );
}
