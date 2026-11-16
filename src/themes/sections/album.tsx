"use client";

import { Check, ChevronLeft, ChevronRight, CircleDot, Download, Film, ImagePlus, Trash2, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { Dialog } from "radix-ui";
import { useLayoutEffect, useOptimistic, useRef, useState, useSyncExternalStore, useTransition, type ReactNode } from "react";
import { approvePhotoAction, deletePhotoAction, setCaptionAction } from "@/album/actions";
import { MAX_CAPTION, MAX_PHOTOS_AT_ONCE, parseCaption, shownIndex } from "@/album/album";
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
import { Caption, CaptionWhileAdding, type SaveCaption } from "./album-captions";
import { prepareFiles, uploadFiles, type Prepared, type UploadOutcome } from "./album-upload";
import type { UploadProblem } from "@/uploads/validate";
import { ItemDetails } from "./item-details";
import { LivePicture } from "./live-picture";
import { RefreshWhileProcessing } from "./refresh-while-processing";
import { VideoPlayer, type ShownSize } from "./video-player";

// One item as the album shows it (M4 ticket 11; videos M7 ticket 07): a photo in its two sizes;
// a ready video with its thumbnail, poster, original (for Download), every size it plays at with
// its file (M8 ticket 06), whether the original is HDR, its codec for the player and its length;
// or a video still processing, or failed (by the reason its tile names, never the processor's
// text), which only its uploader and the hosts see. Each with who added it, or null where this
// viewer is not shown that (M8 ticket 11: left out on the server), whether this viewer may delete
// it, whether it waits for a host's approval (M6 ticket 03), and whether this viewer may approve
// it. An item that opens carries its technical line, and the capture time and camera the host
// keeps, written on the server (M8 ticket 07). A live photo carries its motion's file, and a photo
// whose motion is being made says so (M8 ticket 08), to its uploader and the hosts alone, whose
// pages refresh until it is made. Each has its caption, and whether this viewer may write it (M8
// ticket 09).
type ShownBase = { id: string; name: string | null; deletable: boolean; pending: boolean; approvable: boolean; caption: string | null; captionEditable: boolean };
// `takenAt` is the capture time as written for the viewer, `takenAtIso` the same instant for the
// line's <time> element; both null while the host does not keep it.
type ShownFacts = { details: ShownDetails; takenAt: string | null; takenAtIso: string | null };
export type ShownPhoto = ShownBase &
  (
    | ({ kind: "photo"; thumb: string; large: string; width: number; height: number; motion: string | null; motionPending: boolean } & ShownFacts)
    | ({ kind: "video"; state: "ready"; thumb: string; poster: string; original: string; sizes: ShownSize[]; hdr: boolean; codec: string; durationMs: number; width: number; height: number } & ShownFacts)
    | { kind: "video"; state: "processing" | "failed"; failure: "tooLong" | null }
  );

// What opens in the viewer.
export type Openable = Extract<ShownPhoto, { kind: "photo" } | { state: "ready" }>;
const openable = (photo: ShownPhoto): photo is Openable => photo.kind === "photo" || photo.state === "ready";

// A photo that opens, and a live photo among them (M8 ticket 08): one whose motion is made.
type OpenPhoto = Extract<Openable, { kind: "photo" }>;
export type LivePhoto = OpenPhoto & { motion: string };
const isLive = (photo: ShownPhoto): photo is LivePhoto => photo.kind === "photo" && photo.motion !== null;

// Whether this device is an iPhone or iPad (album/motion.ts, seesLivePhotoNote), which only the
// browser knows: the server's answer, and the first drawing's, is no.
const noSubscription = () => () => undefined;
const onAnIPhone = () => seesLivePhotoNote(navigator.userAgent, navigator.maxTouchPoints);

// A file's status line; one added carries its item's id until it is captioned (M8 ticket 09).
type Line = { name: string; text: string; ok: boolean; id?: string };

// What the host keeps of each item added (album/details.ts, keptNotice), told before anything is
// added; nothing when the host keeps neither.
export type Keeps = "takenAt" | "camera" | "both" | undefined;

// An item's accessible name, the `n`th of those that open: "Photo 3 by Priya Nair", marked when it
// waits for approval, with its caption after it (M8 ticket 09); "Photo 3" where this viewer is not
// shown who added it (M8 ticket 11). An item waiting is shown only to its uploader and the hosts,
// who always have the name. One rule for the tile's and the viewer's pictures, and the player.
function useItemLabel(): (photo: ShownPhoto, n: number) => string {
  const t = useTranslations("EventPage.album");
  return (photo, n) => {
    const label =
      photo.name === null
        ? t(photo.kind === "video" ? "openVideoUnnamed" : "openUnnamed", { n })
        : t(photo.kind === "video" ? (photo.pending ? "openVideoPending" : "openVideo") : photo.pending ? "openPending" : "open", { n, name: photo.name });
    return photo.caption ? t("withCaption", { label, caption: photo.caption }) : label;
  };
}

// What a feature draws in the album (M8 ticket 12; the album vote's, src/voting/album-voting.tsx),
// built on the server: a head above the grid, a node on each item's tile and one in the viewer's
// header, by the item's id, and lists of the items to show, one per choice the page's query names
// (`param`), `initial` when it names none. The album knows nothing of what the nodes are.
export type AlbumSlot = { head: ReactNode; tile: Record<string, ReactNode>; viewer: Record<string, ReactNode>; lists: { param: string; initial: string; ids: Record<string, string[]> } };

// The items a slot lists for the choice in the page's query, in the list's order; every item
// without a slot.
function useListed(photos: ShownPhoto[], slot: AlbumSlot | undefined): ShownPhoto[] {
  const named = useSearchParams().get(slot?.lists.param ?? "");
  if (!slot) return photos;
  const ids = slot.lists.ids[named !== null && Object.hasOwn(slot.lists.ids, named) ? named : slot.lists.initial] ?? [];
  const byId = new Map(photos.map((photo) => [photo.id, photo]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}

// The id of the album's heading, which every layout gives it: where the focus goes once a photo is
// deleted, since the thumbnail that opened it goes with it.
export const ALBUM_HEADING = "album-heading";

const NONE_APPROVING: ReadonlySet<string> = new Set();

// How the host has the album drawn (M8 ticket 30): a grid, as it always was; a mosaic, the first
// item two columns wide and two rows high; or a strip, one row the guest scrolls sideways.
export type AlbumStyle = "grid" | "mosaic" | "strip";

// The album (M4 ticket 11): a grid of the photos, oldest first, each opening the viewer; and Add
// photos, which sends up to ten at once and says what became of each. A photo waiting for approval
// is marked under its thumbnail, and to a host has Approve and Delete there (M6 ticket 03). With a
// slot (M8 ticket 12), its head sits above the grid, the grid lists the slot's items, which the
// numbers and the viewer follow, and each tile and the viewer's header carry the slot's node. In
// the host's style (M8 ticket 30), every style drawing the same tiles.
export function Album({
  slug,
  photos: all,
  maxMegabytes,
  video,
  keeps,
  slot,
  style,
}: {
  slug: string;
  photos: ShownPhoto[];
  maxMegabytes: number;
  video: VideoCaps;
  keeps: Keeps;
  slot?: AlbumSlot;
  style: AlbumStyle;
}) {
  const t = useTranslations("EventPage.album");
  const locale = useLocale();
  const router = useRouter();
  const photos = useListed(all, slot);
  const opening = photos.filter(openable);
  const label = useItemLabel();
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
  // The item open in the viewer, by its id (media part review): a refresh that adds or removes an
  // item before it leaves the viewer on it, and one that removes it closes the viewer.
  const [open, setOpen] = useState<string>();
  const shown = shownIndex(opening.map((photo) => photo.id), open);
  // An item that left the list is forgotten, so the viewer does not open on it again should it come
  // back (media part re-review).
  if (open !== undefined && shown === undefined) setOpen(undefined);
  // The item last shown, whose thumbnail has the focus back once the viewer closes.
  const last = useRef<string | undefined>(undefined);
  const thumbnails = useRef(new Map<string, HTMLButtonElement>());
  const input = useRef<HTMLInputElement>(null);
  const iPhone = useSyncExternalStore(noSubscription, onAnIPhone, () => false);

  // A caption saved through the album's action (M8 ticket 09): the refusal, or the caption as the
  // server stores it.
  const saveCaption: SaveCaption = async (id, draft) => {
    const answer = await setCaptionAction(slug, id, draft);
    if (answer.error) return { error: answer.error };
    const parsed = parseCaption(draft);
    return { caption: parsed.ok ? parsed.caption : null };
  };

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

  const captioned = style !== "grid";
  // One item's tile, the same in every style: its thumbnail, which opens the viewer, with a video's
  // length or the Live mark and the slot's node; or a video still processing; and under it what
  // waits for a host. `className` is the style's, for the tile's place and size. The mosaic's
  // first tile is `big`: its rows are as tall as the tallest tile beside it, a waiting item's
  // Approve and Delete under it included, so its picture grows to fill them, cropped as every
  // thumbnail is, rather than leave a gap under it (ticket 30's review).
  const tile = (photo: ShownPhoto, className?: string, big = false) => {
    const at = opening.indexOf(photo as Openable);
    const n = at + 1;
    return (
      <li key={photo.id} data-item={photo.kind} data-state={photo.kind === "video" ? photo.state : "ready"} className={cn("flex flex-col gap-1", className)}>
        {openable(photo) ? (
          // The slot's node sits beside the thumbnail's button, never inside it: it may hold
          // a button of its own.
          <div className={cn("relative", big && "grow")}>
            <button
              id={`album-item-${photo.id}`}
              ref={(button) => {
                if (button) thumbnails.current.set(photo.id, button);
                else thumbnails.current.delete(photo.id);
              }}
              type="button"
              onClick={() => {
                last.current = photo.id;
                setOpen(photo.id);
              }}
              className={cn(
                "relative block aspect-square w-full cursor-pointer overflow-hidden rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-theme-text",
                big && "h-full",
              )}
            >
              {/* Its id names the item alone, without a video's length or the Live mark,
                  for what a slot labels by it (M8 ticket 12). */}
              {/* eslint-disable-next-line @next/next/no-img-element -- served whole from the uploads route, already sized */}
              <img id={`album-item-${photo.id}-label`} src={photo.thumb} alt={label(photo, n)} loading="lazy" className="size-full object-cover" />
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
            {slot?.tile[photo.id]}
          </div>
        ) : (
          // A video still processing, or one that could not be: its uploader and the hosts
          // see it, nobody else (album/visibility.ts). No pulse: nothing here moves.
          <div
            role={photo.state === "processing" ? "status" : undefined}
            className={cn(
              "flex aspect-square w-full flex-col items-center justify-center gap-1.5 rounded-xl bg-theme-glass-strong px-2 text-center text-xs text-theme-text-muted",
              big && "grow",
            )}
          >
            <Film className="size-6" aria-hidden />
            {photo.state === "processing" ? t("processing") : photo.failure === "tooLong" ? t("failedTooLong", { max: formatMinutes(video.maxMs / 60_000, locale) }) : t("failed")}
          </div>
        )}
        {/* A mosaic and a strip write a caption under its picture, on one line (M8 ticket 30); the
            grid, whose tiles are a third of a phone's width, writes none (ticket 09). It is
            already in the item's name, so it is not read twice; a video still processing, or
            failed, has no such name, so it has none under it either. */}
        {captioned && photo.caption && openable(photo) && (
          <p data-slot="caption" aria-hidden className="truncate text-xs text-theme-text-muted">
            {photo.caption}
          </p>
        )}
        {photo.pending && <p className="text-xs text-theme-text-muted">{t("pending")}</p>}
        {/* Remove, Approve and Delete are for the hosts and the uploader, who always have
            the name (M8 ticket 11). */}
        {!openable(photo) && photo.deletable && photo.name !== null && (
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
        {photo.approvable && photo.name !== null && (
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
                approve(photo.id, () => thumbnails.current.get(photo.id)?.focus())
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
  };

  return (
    <div className="flex flex-col gap-4">
      {slot?.head}
      {all.some((photo) => (photo.kind === "video" ? photo.state === "processing" : photo.motionPending)) && <RefreshWhileProcessing />}
      {photos.length === 0 ? (
        <p className="text-sm text-theme-text-muted">{t("empty")}</p>
      ) : (
        <AlbumItems style={style} label={t("strip")}>
          {photos.map((photo, index) =>
            style === "mosaic" && index === 0 ? tile(photo, "col-span-2 row-span-2", true) : tile(photo, style === "strip" ? "w-40 shrink-0 snap-start" : undefined),
          )}
        </AlbumItems>
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
            aria-describedby={["album-hint", keeps && "album-keeps", iPhone && "album-live-note"].filter(Boolean).join(" ")}
            className="sr-only"
          />
        </label>
        <p id="album-hint" className="text-xs text-theme-text-faint">
          {t("hint", { max: maxMegabytes })}
        </p>
        {/* What the host keeps of each item, said before anything is added (media part review). */}
        {keeps && (
          <p id="album-keeps" data-slot="album-keeps" className="text-xs text-theme-text-faint">
            {t(`keeps.${keeps}`)}
          </p>
        )}
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
                      id={line.id}
                      name={line.name}
                      save={saveCaption}
                      max={MAX_CAPTION}
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
        onShow={(id) => {
          if (id !== undefined) last.current = id;
          setOpen(id);
        }}
        slug={slug}
        approving={approving}
        approve={approve}
        saveCaption={saveCaption}
        slot={slot}
        onClosed={(deleted) => {
          // Its thumbnail, unless the item went, here or elsewhere: then the album's heading.
          const thumbnail = deleted || last.current === undefined ? undefined : thumbnails.current.get(last.current);
          if (thumbnail) thumbnail.focus();
          else document.getElementById(ALBUM_HEADING)?.focus();
        }}
      />
    </div>
  );
}

// The items in the album's style, each tile placed and sized by the style. A strip is a region of
// its own, which the keyboard reaches and scrolls with the arrows and a finger swipes: the
// browser's own scrolling, smooth only where motion is welcome, each tile snapping to its start.
// Its padding leaves room for a thumbnail's focus ring inside the scroller.
function AlbumItems({ style, label, children }: { style: AlbumStyle; label: string; children: ReactNode }) {
  if (style === "strip") {
    return (
      <div
        role="region"
        tabIndex={0}
        aria-label={label}
        className="-m-1 snap-x snap-mandatory scroll-px-1 overflow-x-auto p-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-theme-text motion-safe:scroll-smooth"
      >
        <ul data-style="strip" className="flex gap-1.5">
          {children}
        </ul>
      </div>
    );
  }
  return (
    <ul data-style={style} className="grid grid-cols-3 gap-1.5">
      {children}
    </ul>
  );
}

// The viewer: the photo full screen, the previous and next by the buttons, the arrow keys or a
// swipe, who added it, a slot's node (M8 ticket 12), Download (the large rendition), Approve where
// this viewer may (M6 ticket 03), which stays on the photo and waits, as the one under its
// thumbnail does, while that photo is being approved, Delete where this viewer may, and Escape. It
// shows the item it was opened on or turned to, wherever a refresh moves it, and closes once that
// item is gone (media part review). Closed, the focus is back on the photo's thumbnail, or on the
// album's heading once it is deleted.
function Viewer({
  photos,
  index,
  onShow,
  slug,
  approving,
  approve,
  saveCaption,
  slot,
  onClosed,
}: {
  photos: Openable[];
  index: number | undefined;
  onShow: (id: string | undefined) => void;
  slug: string;
  approving: ReadonlySet<string>;
  approve: (id: string, then: () => void) => void;
  saveCaption: SaveCaption;
  slot: AlbumSlot | undefined;
  onClosed: (deleted: boolean) => void;
}) {
  const t = useTranslations("EventPage.album");
  const label = useItemLabel();
  const deleted = useRef(false);
  const download = useRef<HTMLAnchorElement>(null);
  const swipe = useRef<number | undefined>(undefined);
  const photo = index === undefined ? undefined : photos[index];
  // Whether the shown item's caption is being written (M8 ticket 09): Escape then ends the writing,
  // not the viewer. Showing another item, or closing, ends it too, so coming back finds the caption
  // as it is and the field closed (media part review).
  const [editing, setEditing] = useState(false);
  const [editingFor, setEditingFor] = useState(photo?.id);
  if (editingFor !== photo?.id) {
    setEditingFor(photo?.id);
    setEditing(false);
  }
  // Whether a caption is being written as last drawn, which Escape reads. Radix calls the Escape
  // handler of the last render whose passive effects have run, and a caption's save answers outside
  // any event, so its render's effects wait for a later task: an Escape pressed between, as the
  // saved caption shows, met a handler that still thought it was being written, ended the writing
  // already ended, and left the viewer open (the caption test's flake, the last fix dispatch). This
  // is set as each render is drawn, before anything else can run.
  const writing = useRef(editing);
  useLayoutEffect(() => {
    writing.current = editing;
  });
  const go = (step: number) => index !== undefined && photos.length > 0 && onShow(photos[(index + step + photos.length) % photos.length].id);
  // Who added it, where this viewer is shown that (M8 ticket 11), and whether it waits: nothing at
  // all for an item of someone else's while names are hidden, and then no description either.
  const description = photo && [photo.name !== null && t("by", { name: photo.name }), photo.pending && t("pending")].filter(Boolean).join(" · ");

  return (
    <Dialog.Root open={photo !== undefined} onOpenChange={(open) => !open && onShow(undefined)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-70 bg-black/95" />
        <Dialog.Content
          data-slot="photo-viewer"
          // None when there is nothing to say, as Radix asks of a dialog without a description.
          {...(!description && { "aria-describedby": undefined })}
          onOpenAutoFocus={() => {
            deleted.current = false;
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            onClosed(deleted.current);
          }}
          onEscapeKeyDown={(event) => {
            if (!writing.current) return;
            event.preventDefault();
            setEditing(false);
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
                  {description && <Dialog.Description className="text-xs text-white/70">{description}</Dialog.Description>}
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
                {slot?.viewer[photo.id]}
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
                  // Keyed by the item, so a confirmation open on one is never carried to another.
                  <DeletePhoto
                    key={photo.id}
                    slug={slug}
                    id={photo.id}
                    className="z-80"
                    onDeleted={() => {
                      deleted.current = true;
                      onShow(undefined);
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
                  <VideoPlayer key={photo.id} video={photo} label={label(photo, index + 1)} />
                ) : isLive(photo) ? (
                  <LivePicture key={photo.id} photo={photo} alt={label(photo, index + 1)} />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- served whole from the uploads route, already sized
                  <img
                    src={photo.large}
                    alt={label(photo, index + 1)}
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
              <Caption key={photo.id} photo={photo} editing={editing} onEditing={setEditing} save={saveCaption} max={MAX_CAPTION} />
              <ItemDetails photo={photo} />
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
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
