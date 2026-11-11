"use client";

import { Check, ChevronLeft, ChevronRight, Download, Film, ImagePlus, Trash2, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { useOptimistic, useRef, useState, useTransition, type ReactNode } from "react";
import { approvePhotoAction, deletePhotoAction } from "@/album/actions";
import { MAX_PHOTOS_AT_ONCE } from "@/album/album";
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
import { prepareFiles, uploadFiles, type Prepared, type UploadOutcome } from "./album-upload";
import type { UploadProblem } from "@/uploads/validate";
import { RefreshWhileProcessing } from "./refresh-while-processing";
import { VideoPlayer } from "./video-player";

// One item as the album shows it (M4 ticket 11; videos M7 ticket 07): a photo in its two sizes;
// a ready video with its thumbnail, poster, original and lighter copy, its codec for the player
// and its length; or a video still processing, or failed, which only its uploader and the hosts
// see. Each with who added it, whether this viewer may delete it, whether it waits for a host's
// approval (M6 ticket 03), and whether this viewer may approve it.
type ShownBase = { id: string; name: string; deletable: boolean; pending: boolean; approvable: boolean };
export type ShownPhoto = ShownBase &
  (
    | { kind: "photo"; thumb: string; large: string; width: number; height: number }
    | { kind: "video"; state: "ready"; thumb: string; poster: string; original: string; copy: string | null; codec: string; durationMs: number; width: number; height: number }
    | { kind: "video"; state: "processing" | "failed"; failure: string | null }
  );

// What opens in the viewer.
export type Openable = Extract<ShownPhoto, { kind: "photo" } | { state: "ready" }>;
const openable = (photo: ShownPhoto): photo is Openable => photo.kind === "photo" || photo.state === "ready";

type Line = { name: string; text: string; ok: boolean };

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
  const label = (photo: ShownPhoto, n: number) => t(photo.kind === "video" ? (photo.pending ? "openVideoPending" : "openVideo") : photo.pending ? "openPending" : "open", { n, name: photo.name });
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
        if (outcome.ok) return { name: outcome.name, ok: true, text: t(outcome.kind === "video" ? "uploaded" : outcome.pending ? "addedPending" : "added", { name: outcome.name }) };
        return { name: outcome.name, ok: false, text: t("refusedFile", { name: outcome.name, reason: reason(each, outcome.problem, outcome.max) }) };
      };
      const sending = prepared.filter((each) => !each.problem);
      const lines = prepared.map((each) => lineOf(each));
      setLines([...lines]);
      if (sending.length === 0) return;
      const answer = await uploadFiles(slug, sending, (index, outcome) => {
        lines[prepared.indexOf(sending[index])] = lineOf(sending[index], outcome);
        setLines([...lines]);
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
      {photos.some((photo) => photo.kind === "video" && photo.state === "processing") && <RefreshWhileProcessing />}
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
            aria-describedby="album-hint"
            className="sr-only"
          />
        </label>
        <p id="album-hint" className="text-xs text-theme-text-faint">
          {t("hint", { max: maxMegabytes })}
        </p>
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
  const deleted = useRef(false);
  const download = useRef<HTMLAnchorElement>(null);
  const swipe = useRef<number | undefined>(undefined);
  const photo = index === undefined ? undefined : photos[index];
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
          // The player has its own keys and its own seek bar: nothing from inside it turns the page.
          onKeyDown={(event) => {
            if ((event.target as HTMLElement).closest("video")) return;
            if (event.key === "ArrowRight") go(1);
            if (event.key === "ArrowLeft") go(-1);
          }}
          onPointerDown={(event) => {
            swipe.current = (event.target as HTMLElement).closest("video") ? undefined : event.clientX;
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
              <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-[max(env(safe-area-inset-bottom),1rem)]">
                {photo.kind === "video" ? (
                  <VideoPlayer video={photo} label={t(photo.pending ? "openVideoPending" : "openVideo", { n: index + 1, name: photo.name })} />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- served whole from the uploads route, already sized
                  <img src={photo.large} alt={t(photo.pending ? "openPending" : "open", { n: index + 1, name: photo.name })} width={photo.width} height={photo.height} className="max-h-full max-w-full object-contain select-none" draggable={false} />
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
