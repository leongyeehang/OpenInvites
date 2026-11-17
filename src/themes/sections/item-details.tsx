"use client";

import { useLocale, useTranslations } from "next-intl";
import { clockTime, formatSize } from "@/lib/sizes";
import type { Openable } from "./album";

// The facts under an open item (M8 ticket 07): its technical line ("4K · 60 fps · HDR · 0:42 ·
// 310 MB", "4032 × 3024 · 3.1 MB"), then when it was taken and the camera with its exposure, when
// the host keeps them. Never on the tiles.
export function ItemDetails({ photo }: { photo: Openable }) {
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
