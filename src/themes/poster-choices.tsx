"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { GALLERY_POSTERS, OCCASIONS, type GalleryPosterId } from "./posters";

// The gallery as its own card pictures, grouped by occasion as the editor's Poster sheet groups it:
// checkboxes to pick several, radios to pick the one. Site settings draws them small, for its
// home page's set; Account's Backdrop card (M8 ticket 22) draws them large, two across and four
// from `sm`, each chosen one ringed and ticked, so that it is told apart by more than its colour.
// The ring is in the focus ring's colour, which legibility.ts solves to stand out at 3:1 from
// every surface; the accent itself can fall short of that against the glass (2.3:1 on Cake, M8
// ticket 23).
// The inputs post as `name`, and `idPrefix` keeps the occasions' ids apart from another picker's.
export function PosterChoices({
  mode,
  ids,
  onToggle,
  onPick,
  name,
  idPrefix,
  size = "small",
}: {
  mode: "picked" | "one";
  ids: GalleryPosterId[];
  onToggle: (id: GalleryPosterId, on: boolean) => void;
  onPick: (id: GalleryPosterId) => void;
  name: string;
  idPrefix: string;
  size?: "small" | "large";
}) {
  const names = useTranslations("Posters");
  const large = size === "large";
  return (
    <div className="flex flex-col gap-4">
      {OCCASIONS.map((occasion) => (
        <section key={occasion} aria-labelledby={`${idPrefix}-occasion-${occasion}`} className="flex flex-col gap-2">
          <h3 id={`${idPrefix}-occasion-${occasion}`} className={cn("font-medium text-muted-foreground", large ? "text-sm" : "text-xs")}>
            {names(`occasions.${occasion}`)}
          </h3>
          <ul className={large ? "grid grid-cols-2 gap-4 sm:grid-cols-4" : "grid grid-cols-3 gap-2 sm:grid-cols-5"}>
            {GALLERY_POSTERS.filter((poster) => poster.occasion === occasion).map((poster) => {
              const checked = ids.includes(poster.id);
              const label = names(`names.${poster.id}`);
              return (
                <li key={poster.id}>
                  <label className="relative block cursor-pointer overflow-hidden rounded-lg ring-1 ring-foreground/10 has-[:checked]:ring-2 has-[:checked]:ring-ring has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring">
                    <input
                      type={mode === "one" ? "radio" : "checkbox"}
                      name={name}
                      value={poster.id}
                      checked={checked}
                      onChange={(event) => (mode === "one" ? onPick(poster.id) : onToggle(poster.id, event.target.checked))}
                      aria-label={label}
                      className="peer sr-only"
                    />
                    {/* eslint-disable-next-line @next/next/no-img-element -- the card is already made to size */}
                    <img src={poster.card} alt="" loading="lazy" className="aspect-[4/5] w-full object-cover" />
                    {/* The tick on the chosen one: the accent, with the words' colour on it. */}
                    {large && (
                      <span className="absolute top-2 right-2 hidden size-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm peer-checked:flex" aria-hidden>
                        <Check className="size-4" strokeWidth={3} />
                      </span>
                    )}
                    {/* The name in a box of its own, its words' alone: the picture's height is
                        seldom whole pixels, so the block's top edge shares a row with it. */}
                    <span className={large ? "block truncate px-2 py-1.5 text-sm" : "block truncate px-1.5 py-1 text-xs"}>
                      <span>{label}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
