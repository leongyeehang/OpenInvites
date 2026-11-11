"use client";

import { Check, ChevronLeft, ChevronRight, CircleDot, Download, Film, ImagePlus, Pencil, Plus, Trash2, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { useEffect, useEffectEvent, useOptimistic, useRef, useState, useSyncExternalStore, useTransition, type ReactNode } from "react";
import { approvePhotoAction, deletePhotoAction, setCaptionAction } from "@/album/actions";
import { MAX_CAPTION, MAX_PHOTOS_AT_ONCE, parseCaption } from "@/album/album";
import type { ShownDetails } from "@/album/details";
import { seesLivePhotoNote } from "@/album/motion";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { VideoCaps } from "@/album/video";
import { clockTime, formatMinutes, formatSize, MEGABYTE } from "@/lib/sizes";
import { cn } from "@/lib/utils";
import { prepareFiles, uploadFiles, type Prepared, type UploadOutcome } from "./album-upload";
import type { UploadProblem } from "@/uploads/validate";
import { useReducedMotion } from "../use-reduced-motion";
import { RefreshWhileProcessing } from "./refresh-while-processing";
import { VideoPlayer, type ShownSize } from "./video-player";

// One item as the album shows it (M4 ticket 11; videos M7 ticket 07): a photo in its two sizes;
// a ready video with its thumbnail, poster, original (for Download), every size it plays at with
// its file (M8 ticket 06), whether the original is HDR, its codec for the player and its length;
// or a video still processing, or failed, which only its uploader and the hosts see. Each with who
// added it, whether this viewer may delete it, whether it waits for a host's approval (M6 ticket
// 03), and whether this viewer may approve it. An item that opens carries its technical line, and
// the capture time and camera the host keeps, written on the server (M8 ticket 07). A live photo
// carries its motion's file, and a photo whose motion is being made says so (M8 ticket 08). Each
// has its caption, and whether this viewer may write it (M8 ticket 09).
type ShownBase = { id: string; name: string; deletable: boolean; pending: boolean; approvable: boolean; caption: string | null; captionEditable: boolean };
// `takenAt` is the capture time as written for the viewer, `takenAtIso` the same instant for the
// line's <time> element; both null while the host does not keep it.
type ShownFacts = { details: ShownDetails; takenAt: string | null; takenAtIso: string | null };
export type ShownPhoto = ShownBase &
  (
    | ({ kind: "photo"; thumb: string; large: string; width: number; height: number; motion: string | null; motionPending: boolean } & ShownFacts)
    | ({ kind: "video"; state: "ready"; thumb: string; poster: string; original: string; sizes: ShownSize[]; hdr: boolean; codec: string; durationMs: number; width: number; height: number } & ShownFacts)
    | { kind: "video"; state: "processing" | "failed"; failure: string | null }
  );

// What opens in the viewer.
export type Openable = Extract<ShownPhoto, { kind: "photo" } | { state: "ready" }>;
const openable = (photo: ShownPhoto): photo is Openable => photo.kind === "photo" || photo.state === "ready";

// A photo that opens, and a live photo among them (M8 ticket 08): one whose motion is made.
type OpenPhoto = Extract<Openable, { kind: "photo" }>;
type LivePhoto = OpenPhoto & { motion: string };
const isLive = (photo: ShownPhoto): photo is LivePhoto => photo.kind === "photo" && photo.motion !== null;

// Whether this device is an iPhone or iPad (album/motion.ts, seesLivePhotoNote), which only the
// browser knows: the server's answer, and the first drawing's, is no.
const noSubscription = () => () => undefined;
const onAnIPhone = () => seesLivePhotoNote(navigator.userAgent, navigator.maxTouchPoints);

// A file's status line; one added carries its item's id until it is captioned (M8 ticket 09).
type Line = { name: string; text: string; ok: boolean; id?: string };

// An item's accessible name with its caption after it (M8 ticket 09), or the name alone: the tile's
// and the viewer's pictures, and the player.
function useNamed(): (photo: ShownPhoto, label: string) => string {
  const t = useTranslations("EventPage.album");
  return (photo, label) => (photo.caption ? t("withCaption", { label, caption: photo.caption }) : label);
}

// The id of the album's heading, which every layout gives it: where the focus goes once a photo is
// deleted, since the thumbnail that opened it goes with it.
export const ALBUM_HEADING = "album-heading";

const NONE_APPROVING: ReadonlySet<string> = new Set();

// The album (M4 ticket 11): a grid of the photos, oldest first, each opening the viewer; and Add
// photos, which sends up to ten at once and says what became of each. A photo waiting for approval
// is marked under its thumbnail, and to a host has Approve and Delete there (M6 ticket 03).
export function Album({ slug, photos, maxMegabytes, video }: { slug: string; photos: ShownPhoto[]; maxMegabytes: number; video: VideoCaps }) {
  const t = useTranslations("EventPage.album");
  const locale = useLocale();
  const router = useRouter();
  const opening = photos.filter(openable);
  const named = useNamed();
  const label = (photo: ShownPhoto, n: number) => named(photo, t(photo.kind === "video" ? (photo.pending ? "openVideoPending" : "openVideo") : photo.pending ? "openPending" : "open", { n, name: photo.name }));
  const [adding, setAdding] = useState<number>();
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState<string>();
  const [, startRefresh] = useTransition();
  // The photos being approved, from under their thumbnails or in the viewer: only their own Approve
  // waits, and every photo is back to none once the approvals and the page's redrawing are done.
  const [approving, markApproving] = useOptimistic(NONE_APPROVING, (ids, id: string) => new Set(ids).add(id));
  const [, startApproving] = useTransition();
  const approve = (id: string, then: () => void) =>
    startApproving(async () => {
      markApproving(id);
      await approvePhotoAction(slug, id);
      then();
      router.refresh();
    });
  const [shown, setShown] = useState<number>();
  // The photo last shown, whose thumbnail has the focus back once the viewer closes.
  const last = useRef<number | undefined>(undefined);
  const thumbnails = useRef<(HTMLButtonElement | null)[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const iPhone = useSyncExternalStore(noSubscription, onAnIPhone, () => false);

  // Through the upload protocol (M7 tickets 06 and 07; album-upload.ts): checked before anything is
  // sent, then the ask, each file's parts, each file's finish; the lines say what became of each.
  const add = async (files: File[]) => {
    setLines([]);
    setError(undefined);
    if (files.length === 0) return;
    if (files.length > MAX_PHOTOS_AT_ONCE) return setError(t(video.allowed ? "errors.tooManyItems" : "errors.tooMany"));
    setAdding(files.length);
    try {
      const prepared = await prepareFiles(files, { maxPhotoBytes: maxMegabytes * MEGABYTE, video });
      // Why a file was refused, here before sending or by the server at the ask, which names the
      // cap it applied (`max`) when the host lowered it under what this page knew.
      const reason = (each: Prepared, problem: Prepared["problem"] | UploadProblem, max?: number) => {
        if (problem === "tooLong" && each.durationMs) return t("problems.tooLongKnown", { max: formatMinutes((max ?? video.maxMs) / 60_000, locale), length: clockTime(each.durationMs) });
        if (problem === "tooLarge" && each.kind === "video") return t("problems.videoTooLargeKnown", { max: formatSize(max ?? video.maxBytes, locale), size: formatSize(each.file.size, locale) });
        return t(`problems.${problem ?? "incomplete"}`, { max: max !== undefined ? max / MEGABYTE : maxMegabytes });
      };
      const lineOf = (each: Prepared, outcome?: UploadOutcome): Line => {
        if (each.problem) return { name: each.file.name, ok: false, text: t("refusedFile", { name: each.file.name, reason: reason(each, each.problem) }) };
        if (!outcome) return { name: each.file.name, ok: true, text: t("uploading", { name: each.file.name }) };
        if (outcome.ok) return { name: outcome.name, ok: true, id: outcome.id, text: t(outcome.kind === "video" ? "uploaded" : outcome.pending ? "addedPending" : "added", { name: outcome.name }) };
        return { name: outcome.name, ok: false, text: t("refusedFile", { name: outcome.name, reason: reason(each, outcome.problem, outcome.max) }) };
      };
      const sending = prepared.filter((each) => !each.problem);
      setLines(prepared.map((each) => lineOf(each)));
      if (sending.length === 0) return;
      // Each line from what it was, so a caption saved on one meanwhile stays saved.
      const answer = await uploadFiles(slug, sending, (index, outcome) => {
        const at = prepared.indexOf(sending[index]);
        setLines((current) => current.map((line, each) => (each === at ? lineOf(sending[index], outcome) : line)));
      });
      // A storage refusal names its limit in plain units (M7 ticket 02); the others use what they use.
      if (answer.error) setError(t(`errors.${answer.error}`, { left: answer.left ?? 0, limit: formatSize(answer.limit ?? 0, locale) }));
      else if (!answer.results) setError(t("errors.failed"));
      else startRefresh(() => router.refresh());
    } catch {
      setError(t("errors.failed"));
    } finally {
      setAdding(undefined);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {photos.some((photo) => (photo.kind === "video" ? photo.state === "processing" : photo.motionPending)) && <RefreshWhileProcessing />}
      {photos.length === 0 ? (
        <p className="text-sm text-theme-text-muted">{t("empty")}</p>
      ) : (
        <ul className="grid grid-cols-3 gap-1.5">
          {photos.map((photo) => {
            const at = opening.indexOf(photo as Openable);
            const n = at + 1;
            return (
              <li key={photo.id} data-item={photo.kind} data-state={photo.kind === "video" ? photo.state : "ready"} className="flex flex-col gap-1">
                {openable(photo) ? (
                  <button
                    ref={(button) => {
                      thumbnails.current[at] = button;
                    }}
                    type="button"
                    onClick={() => {
                      last.current = at;
                      setShown(at);
                    }}
                    className="relative block aspect-square w-full cursor-pointer overflow-hidden rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-theme-text"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- served whole from the uploads route, already sized */}
                    <img src={photo.thumb} alt={label(photo, n)} loading="lazy" className="size-full object-cover" />
                    {photo.kind === "video" && (
                      <span className="absolute bottom-1 left-1 inline-flex items-center gap-1 rounded-full bg-black/50 px-1.5 py-0.5 text-[11px] font-medium text-white">
                        <Film className="size-3" aria-hidden />
                        {clockTime(photo.durationMs)}
                      </span>
                    )}
                    {/* A live photo's mark is inside the tile's button, never a button of its own. */}
                    {isLive(photo) && (
                      <span data-slot="live-mark" className="absolute bottom-1 left-1 inline-flex items-center gap-1 rounded-full bg-black/50 px-1.5 py-0.5 text-[11px] font-medium text-white">
                        <CircleDot className="size-3" aria-hidden />
                        {t("live")}
                      </span>
                    )}
                  </button>
                ) : (
                  // A video still processing, or one that could not be: its uploader and the hosts
                  // see it, nobody else (album/visibility.ts). No pulse: nothing here moves.
                  <div
                    role={photo.state === "processing" ? "status" : undefined}
                    className="flex aspect-square w-full flex-col items-center justify-center gap-1.5 rounded-xl bg-theme-glass-strong px-2 text-center text-xs text-theme-text-muted"
                  >
                    <Film className="size-6" aria-hidden />
                    {photo.state === "processing" ? t("processing") : photo.failure === "tooLong" ? t("failedTooLong", { max: formatMinutes(video.maxMs / 60_000, locale) }) : t("failed")}
                  </div>
                )}
                {photo.pending && <p className="text-xs text-theme-text-muted">{t("pending")}</p>}
                {!openable(photo) && photo.deletable && (
                  <DeletePhoto slug={slug} id={photo.id} focusOnceDeleted={() => document.getElementById(ALBUM_HEADING)?.focus()}>
                    <button
                      type="button"
                      aria-label={t("removeVideo", { name: photo.name })}
                      className="inline-flex h-9 cursor-pointer items-center gap-1.5 self-start rounded-full bg-theme-glass-strong px-3 text-xs font-medium hover:bg-theme-glass focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-theme-text"
                    >
                      <Trash2 className="size-4" aria-hidden />
                      {t("remove")}
                    </button>
                  </DeletePhoto>
                )}
                {photo.approvable && (
                  // Two round buttons in one row, which fit the narrowest column (the Thread's, about
                  // 80px at a phone's width): Approve, in the accent, and Delete. Approve has no word
                  // of its own, so its name is its tooltip too, and while it approves it is dimmed and
                  // busy (M6 ticket 10).
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label={t("approvePhoto", { n, name: photo.name })}
                      title={t("approvePhoto", { n, name: photo.name })}
                      disabled={approving.has(photo.id)}
                      aria-busy={approving.has(photo.id)}
                      onClick={() =>
                        // The controls go once it is approved; the focus stays with its item.
                        approve(photo.id, () => thumbnails.current[at]?.focus())
                      }
                      className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-theme-accent text-theme-on-accent hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-theme-text disabled:cursor-wait disabled:opacity-50"
                    >
                      <Check className="size-4" aria-hidden />
                    </button>
                    <DeletePhoto
                      slug={slug}
                      id={photo.id}
                      // The thumbnail goes with it.
                      focusOnceDeleted={() => document.getElementById(ALBUM_HEADING)?.focus()}
                    >
                      <button
                        type="button"
                        aria-label={t("deletePhoto", { n, name: photo.name })}
                        className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-theme-glass-strong hover:bg-theme-glass focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-theme-text"
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </DeletePhoto>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="inline-flex h-10 cursor-pointer items-center gap-2 self-start rounded-full bg-theme-glass-strong px-4 text-sm font-medium hover:bg-theme-glass has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-theme-text has-disabled:cursor-wait">
          <ImagePlus className="size-4" aria-hidden />
          {adding ? t("adding", { count: adding }) : t(video.allowed ? "addVideos" : "add")}
          <input
            ref={input}
            type="file"
            // Named types rather than image/*, so an iPhone keeps handing over JPEG (plan ruling 16).
            accept={video.allowed ? "image/jpeg,image/png,image/webp,image/avif,video/*" : "image/jpeg,image/png,image/webp,image/avif"}
            multiple
            disabled={adding !== undefined}
            onChange={(event) => void add([...(event.target.files ?? [])])}
            aria-describedby={iPhone ? "album-hint album-live-note" : "album-hint"}
            className="sr-only"
          />
        </label>
        <p id="album-hint" className="text-xs text-theme-text-faint">
          {t("hint", { max: maxMegabytes })}
        </p>
        {/* An iPhone hands a page only a Live Photo's still (M8 ticket 08): said once, where the
            guest adds, and Save as Video suggested only where the event takes videos. */}
        {iPhone && (
          <p id="album-live-note" className="text-xs text-theme-text-faint">
            {t(video.allowed ? "livePhotoNote" : "livePhotoNoteNoVideos")}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm font-medium">
            {error}
          </p>
        )}
        {lines.length > 0 && (
          <div role="status">
            <ul className="flex flex-col gap-0.5 text-sm">
              {lines.map((line, index) => (
                <li key={index} className={line.ok ? "text-theme-text-muted" : "font-medium"}>
                  {line.text}
                </li>
              ))}
            </ul>
          </div>
        )}
        {/* Outside the status, so typing in a field is not read out as news; saved, the file's own
            line says so. */}
        {lines.some((line) => line.id) && (
          <ul className="flex flex-col gap-2">
            {lines.map(
              (line, index) =>
                line.id && (
                  <li key={line.id}>
                    <CaptionWhileAdding
                      slug={slug}
                      id={line.id}
                      name={line.name}
                      // Its field goes once saved, so the focus goes back to where files are added.
                      onSaved={() => {
                        setLines((current) => current.map((each, at) => (at === index ? { ...each, id: undefined, text: t("captionSaved", { name: each.name }) } : each)));
                        input.current?.focus();
                        startRefresh(() => router.refresh());
                      }}
                    />
                  </li>
                ),
            )}
          </ul>
        )}
      </div>

      <Viewer
        photos={opening}
        index={shown}
        onIndex={(index) => {
          if (index !== undefined) last.current = index;
          setShown(index);
        }}
        slug={slug}
        approving={approving}
        approve={approve}
        onClosed={(deleted) => {
          if (deleted) document.getElementById(ALBUM_HEADING)?.focus();
          else if (last.current !== undefined) thumbnails.current[last.current]?.focus();
        }}
      />
    </div>
  );
}

// The viewer: the photo full screen, the previous and next by the buttons, the arrow keys or a
// swipe, who added it, Download (the large rendition), Approve where this viewer may (M6 ticket
// 03), which stays on the photo and waits, as the one under its thumbnail does, while that photo
// is being approved, Delete where this viewer may, and Escape. Closed, the focus is back on the
// photo's thumbnail, or on the album's heading once it is deleted.
function Viewer({
  photos,
  index,
  onIndex,
  slug,
  approving,
  approve,
  onClosed,
}: {
  photos: Openable[];
  index: number | undefined;
  onIndex: (index: number | undefined) => void;
  slug: string;
  approving: ReadonlySet<string>;
  approve: (id: string, then: () => void) => void;
  onClosed: (deleted: boolean) => void;
}) {
  const t = useTranslations("EventPage.album");
  const named = useNamed();
  const deleted = useRef(false);
  const download = useRef<HTMLAnchorElement>(null);
  const swipe = useRef<number | undefined>(undefined);
  const photo = index === undefined ? undefined : photos[index];
  // The item whose caption is being written, if any (M8 ticket 09): Escape then ends the writing,
  // not the viewer, and turning the page leaves it.
  const [captioning, setCaptioning] = useState<string>();
  const editing = photo !== undefined && captioning === photo.id;
  const go = (step: number) => index !== undefined && photos.length > 0 && onIndex((index + step + photos.length) % photos.length);

  return (
    <Dialog.Root open={photo !== undefined} onOpenChange={(open) => !open && onIndex(undefined)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-70 bg-black/95" />
        <Dialog.Content
          data-slot="photo-viewer"
          onOpenAutoFocus={() => {
            deleted.current = false;
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            onClosed(deleted.current);
          }}
          onEscapeKeyDown={(event) => {
            if (!editing) return;
            event.preventDefault();
            setCaptioning(undefined);
          }}
          // The player has its own keys and its own seek bar, and the caption's field its own
          // cursor: nothing from inside either turns the page.
          onKeyDown={(event) => {
            if ((event.target as HTMLElement).closest("video, input")) return;
            if (event.key === "ArrowRight") go(1);
            if (event.key === "ArrowLeft") go(-1);
          }}
          onPointerDown={(event) => {
            swipe.current = (event.target as HTMLElement).closest("video, input") ? undefined : event.clientX;
          }}
          onPointerUp={(event) => {
            if (swipe.current === undefined) return;
            const moved = event.clientX - swipe.current;
            swipe.current = undefined;
            if (Math.abs(moved) > 50) go(moved < 0 ? 1 : -1);
          }}
          className="dark fixed inset-0 z-70 flex flex-col text-white outline-none"
        >
          {photo && index !== undefined && (
            <>
              <header className="flex items-center gap-3 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-2">
                <div className="min-w-0 flex-1">
                  <Dialog.Title className="text-sm font-medium">{t(photo.kind === "video" ? "viewerVideo" : "viewer", { n: index + 1, count: photos.length })}</Dialog.Title>
                  <Dialog.Description className="text-xs text-white/70">
                    {t("by", { name: photo.name })}
                    {photo.pending && ` · ${t("pending")}`}
                  </Dialog.Description>
                </div>
                {photo.approvable && (
                  <button
                    type="button"
                    disabled={approving.has(photo.id)}
                    onClick={() =>
                      // Approve goes once it is approved; the viewer stays on the photo.
                      approve(photo.id, () => download.current?.focus())
                    }
                    className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-full bg-white/15 px-4 text-sm font-medium hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-white disabled:cursor-wait"
                  >
                    <Check className="size-4" aria-hidden />
                    {t("approve")}
                  </button>
                )}
                <a
                  ref={download}
                  href={photo.kind === "video" ? photo.original : photo.large}
                  download
                  className="inline-flex size-10 items-center justify-center rounded-full hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
                  aria-label={t("download")}
                >
                  <Download className="size-5" aria-hidden />
                </a>
                {photo.deletable && (
                  <DeletePhoto
                    slug={slug}
                    id={photo.id}
                    className="z-80"
                    onDeleted={() => {
                      deleted.current = true;
                      onIndex(undefined);
                    }}
                  >
                    <button
                      type="button"
                      aria-label={t("delete")}
                      className="inline-flex size-10 cursor-pointer items-center justify-center rounded-full hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
                    >
                      <Trash2 className="size-5" aria-hidden />
                    </button>
                  </DeletePhoto>
                )}
                <Dialog.Close
                  aria-label={t("close")}
                  className="inline-flex size-10 cursor-pointer items-center justify-center rounded-full hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
                >
                  <X className="size-5" aria-hidden />
                </Dialog.Close>
              </header>
              <div className={cn("relative flex min-h-0 flex-1 items-center justify-center px-2 pb-2", isLive(photo) && "[container-type:size]")}>
                {photo.kind === "video" ? (
                  <VideoPlayer key={photo.id} video={photo} label={named(photo, t(photo.pending ? "openVideoPending" : "openVideo", { n: index + 1, name: photo.name }))} />
                ) : isLive(photo) ? (
                  <LivePicture key={photo.id} photo={photo} alt={named(photo, t(photo.pending ? "openPending" : "open", { n: index + 1, name: photo.name }))} />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- served whole from the uploads route, already sized
                  <img
                    src={photo.large}
                    alt={named(photo, t(photo.pending ? "openPending" : "open", { n: index + 1, name: photo.name }))}
                    width={photo.width}
                    height={photo.height}
                    className="max-h-full max-w-full object-contain select-none"
                    draggable={false}
                  />
                )}
                {photos.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => go(-1)}
                      aria-label={t("previous")}
                      className="absolute top-1/2 left-2 inline-flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-black/40 hover:bg-black/60 focus-visible:outline-2 focus-visible:outline-white"
                    >
                      <ChevronLeft className="size-6" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => go(1)}
                      aria-label={t("next")}
                      className="absolute top-1/2 right-2 inline-flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-black/40 hover:bg-black/60 focus-visible:outline-2 focus-visible:outline-white"
                    >
                      <ChevronRight className="size-6" aria-hidden />
                    </button>
                  </>
                )}
              </div>
              <Caption key={photo.id} slug={slug} photo={photo} editing={editing} onEditing={(on) => setCaptioning(on ? photo.id : undefined)} />
              <ItemDetails photo={photo} />
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

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
function LivePicture({ photo, alt }: { photo: LivePhoto; alt: string }) {
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

// An item's caption under it in the viewer (M8 ticket 09), drawn as text, and for whoever may write
// it Add a caption or Edit caption, which opens a field in its place: Enter saves, Escape (the
// viewer's, while writing) and Cancel leave it, and either way the focus is back on the button. A
// refusal is said under the field. Saved, the caption shows at once and the page is drawn again.
function Caption({ slug, photo, editing, onEditing }: { slug: string; photo: Openable; editing: boolean; onEditing: (on: boolean) => void }) {
  const t = useTranslations("EventPage.album");
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string>();
  const [saving, startSaving] = useTransition();
  // What was saved here, shown in place of the caption it replaced until the page drawn again
  // brings it.
  const [saved, setSaved] = useState<{ over: string | null; caption: string | null }>();
  // Set when writing begins, so the button has the focus back when it returns.
  const refocus = useRef(false);
  const caption = saved && saved.over === photo.caption ? saved.caption : photo.caption;
  if (!caption && !photo.captionEditable) return null;

  const begin = () => {
    refocus.current = true;
    setDraft(caption ?? "");
    setError(undefined);
    onEditing(true);
  };
  const save = () =>
    startSaving(async () => {
      const answer = await setCaptionAction(slug, photo.id, draft);
      if (answer.error) return setError(t(`errors.${answer.error}`));
      const parsed = parseCaption(draft);
      if (parsed.ok) setSaved({ over: photo.caption, caption: parsed.caption });
      onEditing(false);
      router.refresh();
    });

  return (
    <div className="flex flex-col items-center gap-1 px-4 pt-1 pb-2 text-center">
      {editing ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
          className="flex w-full max-w-md flex-col gap-1.5 text-left"
        >
          <div className="flex items-baseline justify-between gap-2 text-xs text-white/70">
            <label htmlFor="caption-field">{t("caption")}</label>
            <span id="caption-count">
              {draft.length}/{MAX_CAPTION}
            </span>
          </div>
          <input
            id="caption-field"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={MAX_CAPTION}
            autoComplete="off"
            autoFocus
            aria-describedby={error ? "caption-count caption-error" : "caption-count"}
            aria-invalid={error ? true : undefined}
            className="h-10 w-full rounded-full bg-white/10 px-4 text-sm text-white focus-visible:outline-2 focus-visible:outline-white"
          />
          {error && (
            <p id="caption-error" role="alert" className="text-sm font-medium">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => onEditing(false)}
              className="inline-flex h-10 cursor-pointer items-center rounded-full px-4 text-sm font-medium hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
            >
              {t("cancelCaption")}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-10 cursor-pointer items-center rounded-full bg-white px-4 text-sm font-medium text-black hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-wait disabled:opacity-60"
            >
              {t("saveCaption")}
            </button>
          </div>
        </form>
      ) : (
        <>
          {caption && (
            <p data-slot="caption" className="max-w-prose text-sm break-words text-white">
              {caption}
            </p>
          )}
          {photo.captionEditable && (
            <button
              ref={(button) => {
                if (!button || !refocus.current) return;
                refocus.current = false;
                button.focus();
              }}
              type="button"
              onClick={begin}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3 text-xs font-medium text-white/80 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
            >
              {caption ? <Pencil className="size-3.5" aria-hidden /> : <Plus className="size-3.5" aria-hidden />}
              {t(caption ? "editCaption" : "addCaption")}
            </button>
          )}
        </>
      )}
    </div>
  );
}

// A caption written for a file just added (M8 ticket 09), under the status lines, with the same
// action as the viewer's: the picker sends files as soon as they are picked, so this is where one
// is written while adding. Saved, the file's status line says so.
function CaptionWhileAdding({ slug, id, name, onSaved }: { slug: string; id: string; name: string; onSaved: () => void }) {
  const t = useTranslations("EventPage.album");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string>();
  const [saving, startSaving] = useTransition();
  const field = `caption-${id}`;
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        startSaving(async () => {
          const answer = await setCaptionAction(slug, id, draft);
          if (answer.error) return setError(t(`errors.${answer.error}`));
          onSaved();
        });
      }}
      className="flex flex-col gap-1"
    >
      <label htmlFor={field} className="text-xs text-theme-text-muted">
        {t("captionFor", { name })}
      </label>
      <div className="flex items-center gap-1.5">
        <input
          id={field}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={MAX_CAPTION}
          autoComplete="off"
          aria-describedby={error ? `${field}-error` : undefined}
          aria-invalid={error ? true : undefined}
          className="h-9 min-w-0 flex-1 rounded-full bg-theme-glass-strong px-3 text-sm text-theme-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-theme-text"
        />
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-9 shrink-0 cursor-pointer items-center rounded-full bg-theme-glass-strong px-3 text-xs font-medium text-theme-text hover:bg-theme-glass focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-theme-text disabled:cursor-wait"
        >
          {t("saveCaption")}
        </button>
      </div>
      {error && (
        <p id={`${field}-error`} role="alert" className="text-sm font-medium text-theme-text">
          {error}
        </p>
      )}
    </form>
  );
}

// The facts under an open item (M8 ticket 07): its technical line ("4K · 60 fps · HDR · 0:42 ·
// 310 MB", "4032 × 3024 · 3.1 MB"), then when it was taken and the camera with its exposure, when
// the host keeps them. Never on the tiles.
function ItemDetails({ photo }: { photo: Openable }) {
  const t = useTranslations("EventPage.album");
  const locale = useLocale();
  const { details, takenAt, takenAtIso } = photo;
  const technical =
    details.kind === "photo"
      ? [`${details.width} × ${details.height}`]
      : [details.size, details.fps !== undefined && t("details.fps", { fps: details.fps }), details.hdr && t("details.hdr"), clockTime(details.durationMs)];
  const line = (parts: (string | false | undefined)[]) => parts.filter(Boolean).join(" · ");
  const facts = line([...technical, details.bytes !== undefined && formatSize(details.bytes, locale)]);
  const camera = line([details.camera, details.exposure]);
  return (
    <div data-slot="item-details" className="px-4 pb-[max(env(safe-area-inset-bottom),1rem)] text-center text-xs text-white/70">
      <p>{facts}</p>
      {takenAt && takenAtIso && (
        <p>
          <time dateTime={takenAtIso}>{t("details.taken", { when: takenAt })}</time>
        </p>
      )}
      {camera && <p>{camera}</p>}
    </div>
  );
}

// Delete, confirmed, for the photo `id`, opened by the button it is given: in the viewer's header,
// and under a thumbnail waiting for approval (M6 ticket 03). `onDeleted` is told once the photo
// is gone; `focusOnceDeleted` puts the focus somewhere that stays, as the confirmation closes on a
// photo deleted. Kept, the focus goes back to the button.
function DeletePhoto({
  slug,
  id,
  className,
  onDeleted,
  focusOnceDeleted,
  children,
}: {
  slug: string;
  id: string;
  className?: string;
  onDeleted?: () => void;
  focusOnceDeleted?: () => void;
  children: ReactNode;
}) {
  const t = useTranslations("EventPage.album");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, startDeleting] = useTransition();
  const deleted = useRef(false);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent
        className={className}
        onOpenAutoFocus={() => {
          deleted.current = false;
        }}
        onCloseAutoFocus={(event) => {
          if (!deleted.current || !focusOnceDeleted) return;
          event.preventDefault();
          focusOnceDeleted();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("deleteText")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel type="button">{t("keep")}</AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            disabled={deleting}
            onClick={() =>
              startDeleting(async () => {
                await deletePhotoAction(slug, id);
                deleted.current = true;
                setOpen(false);
                onDeleted?.();
                router.refresh();
              })
            }
          >
            {t("deleteConfirm")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
