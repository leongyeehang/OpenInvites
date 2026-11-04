"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useRef, type CSSProperties, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ThemeUpload } from "@/themes/resolve";
import type { Layout } from "@/themes/theme";
import { ALT_TEXT_MAX, UPLOAD_TYPES } from "@/uploads/validate";

// The pieces the editor's design sheets are made of (M4 spec, "The toolbar"), the Design drawer's
// before them: tiles chosen as radios, groups of them under a heading, segmented choices, the
// layouts' sketches, and the picture's file picker and description.

export const MEGABYTE = 1024 * 1024;

export function fillWith(src: string): CSSProperties {
  return { backgroundImage: `url(${src})`, backgroundSize: "cover", backgroundPosition: "center" };
}

// A hidden file picker inside the label that opens it. Only the kinds of picture the server
// takes are offered, which also has Safari send an iPhone's HEIC photo as a JPEG.
export function PictureInput({ disabled, onPick, describedBy }: { disabled: boolean; onPick: (file: File) => void; describedBy: string }) {
  return (
    <input
      type="file"
      accept={UPLOAD_TYPES.map((type) => `image/${type}`).join(",")}
      disabled={disabled}
      aria-describedby={describedBy}
      className="sr-only"
      onChange={(event) => {
        const file = event.currentTarget.files?.[0];
        // Cleared, so choosing the same file again still counts.
        event.currentTarget.value = "";
        if (file) onPick(file);
      }}
    />
  );
}

// The host's description of their picture, saved when they leave the field (or press Enter, or
// close the panel with Escape).
export function AltText({ upload, onSave }: { upload: ThemeUpload; onSave: (altText: string) => void }) {
  const t = useTranslations("Design");
  const id = useId();
  const saved = useRef(upload.altText);
  const save = (value: string) => {
    const altText = value.trim();
    if (altText === saved.current) return;
    saved.current = altText;
    onSave(altText);
  };
  return (
    <div>
      <label htmlFor={id} className={cn(HEADING, "mb-2.5 block")}>
        {t("altText")}
      </label>
      <p id={`${id}-hint`} className={HINT}>
        {t("altTextHint")}
      </p>
      <Input
        id={id}
        defaultValue={upload.altText}
        maxLength={ALT_TEXT_MAX}
        aria-describedby={`${id}-hint`}
        onBlur={(event) => save(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === "Escape") save(event.currentTarget.value);
        }}
        className="h-10"
      />
    </div>
  );
}

export function TileName({ children }: { children: ReactNode }) {
  return (
    <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent px-1.5 pt-4 pb-1 text-[10px] leading-tight font-medium text-white">
      {children}
    </span>
  );
}

// A row of the poster group: an occasion, or the colours, named above its tiles.
export function PosterRow({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id}>
      <p id={id} className="mb-2 text-xs font-medium text-muted-foreground">
        {label}
      </p>
      <div className="grid grid-cols-4 gap-2">{children}</div>
    </div>
  );
}

// A wireframe of each layout.
export function LayoutSketch({ layout }: { layout: Layout }) {
  const bar = "rounded-[2px] bg-foreground/35";
  return (
    <span aria-hidden className="flex h-14 w-full flex-col gap-1 rounded-md bg-foreground/5 p-1.5">
      {layout === "poster" && (
        <>
          <span className={cn(bar, "h-5 w-full rounded-[4px] bg-foreground/45")} />
          <span className="flex gap-1">
            <span className={cn(bar, "h-2 flex-1")} />
            <span className={cn(bar, "h-2 flex-1")} />
            <span className={cn(bar, "h-2 flex-1")} />
          </span>
          <span className={cn(bar, "h-1.5 w-3/4")} />
        </>
      )}
      {layout === "broadsheet" && (
        <>
          <span className={cn(bar, "h-px w-full bg-foreground/60")} />
          <span className="flex flex-1 gap-1.5">
            <span className="flex flex-1 flex-col gap-1">
              <span className={cn(bar, "h-3 w-full bg-foreground/60")} />
              <span className={cn(bar, "h-1.5 w-full")} />
              <span className={cn(bar, "h-1.5 w-2/3")} />
            </span>
            <span className={cn(bar, "w-1/3 bg-foreground/25")} />
          </span>
        </>
      )}
      {layout === "thread" && (
        <>
          <span className={cn(bar, "h-2.5 w-3/5 rounded-md")} />
          <span className={cn(bar, "h-2.5 w-4/5 rounded-md")} />
          <span className={cn(bar, "h-2.5 w-2/5 self-end rounded-md bg-foreground/60")} />
        </>
      )}
    </span>
  );
}

export const HEADING = "text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase";
export const HINT = "-mt-1.5 mb-2.5 text-xs text-muted-foreground";

// A group of choices, one of which is on: a fieldset whose legend reads like the other headings,
// with its hint under it as a description rather than part of its name. A fieldset is at least as
// wide as its content unless told otherwise (min-w-0), which would make the whole panel scroll
// sideways to fit anything wide inside it.
export function Choices({ legend, hint, children }: { legend: string; hint?: string; children: ReactNode }) {
  const hintId = useId();
  return (
    <fieldset aria-describedby={hint && hintId} className="min-w-0">
      <legend className={cn(HEADING, "mb-2.5")}>{legend}</legend>
      {hint && (
        <p id={hintId} className={HINT}>
          {hint}
        </p>
      )}
      {children}
    </fieldset>
  );
}

// One choice: a radio button laid invisibly over its tile, so the tile is what the host taps and
// the radio is what the keyboard and a screen reader meet.
export function Choice({
  name,
  checked,
  onSelect,
  className,
  style,
  children,
}: {
  name: string;
  checked: boolean;
  onSelect: () => void;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <label
      className={cn(
        "relative flex overflow-hidden rounded-xl ring-offset-2 ring-offset-popover has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-4 has-[:focus-visible]:outline-ring",
        checked ? "ring-2 ring-foreground" : "ring-1 ring-border",
        "cursor-pointer hover:ring-foreground/50",
        className,
      )}
      style={style}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onSelect}
        className="absolute inset-0 z-10 m-0 cursor-[inherit] appearance-none opacity-0"
      />
      {children}
    </label>
  );
}

export function Segmented<T extends string>({
  legend,
  hint,
  name,
  value,
  options,
  onSelect,
}: {
  legend: string;
  hint?: string;
  name: string;
  value: T;
  options: { value: T; label: string }[];
  onSelect: (value: T) => void;
}) {
  return (
    <Choices legend={legend} hint={hint}>
      <div className="inline-flex flex-wrap gap-1 rounded-full bg-accent/60 p-1">
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              "relative inline-flex h-9 cursor-pointer items-center rounded-full px-3.5 text-xs font-medium transition-colors motion-reduce:transition-none has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
              value === option.value ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <input
              type="radio"
              name={name}
              checked={value === option.value}
              onChange={() => onSelect(option.value)}
              className="absolute inset-0 m-0 cursor-pointer appearance-none opacity-0"
            />
            {option.label}
          </label>
        ))}
      </div>
    </Choices>
  );
}

// The mark on a chosen tile, so the choice never rests on colour alone.
export function Tick() {
  return (
    <span aria-hidden className="absolute top-1 right-1 grid size-5 place-items-center rounded-full bg-foreground text-background">
      <Check className="size-3" />
    </span>
  );
}
