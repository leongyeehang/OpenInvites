import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { resolveTheme, type ThemeUpload } from "./resolve";
import type { Theme } from "./theme";
import { TITLE_FONT_CLASSES } from "./title-fonts";

// An event's poster at the size of a tile on the dashboard (dashboard spec, "Architecture"): the
// poster its theme names, resolved as the event page resolves it, at 4:5, with the title on it in
// the event's own font. A gallery poster or the host's picture is the picture itself, a colour its
// gradient. However the event page places the title, here it always sits on the poster, white on a
// dark shade at its foot, so every tile on the shelf reads the same way. The shade holds most of its
// strength over the whole title, two or three lines of it on a light poster too, and fades only
// above it. The picture is decoration:
// the link around the tile carries the title.
export function PosterTile({
  theme,
  upload,
  title,
  sizes,
  chip,
  faded = false,
  priority = false,
  titleClassName,
  className,
}: {
  theme: Theme;
  upload: ThemeUpload | null;
  // Without one, the poster alone: the dashboard's first-invitation card.
  title?: string;
  // How wide the tile is drawn, for the host's picture's renditions.
  sizes: string;
  chip?: ReactNode;
  faded?: boolean;
  priority?: boolean;
  titleClassName?: string;
  className?: string;
}) {
  const { poster, background, font } = resolveTheme(theme, upload);
  return (
    <div className={cn("relative isolate aspect-[4/5] w-full max-w-full overflow-hidden rounded-2xl bg-muted shadow-sm ring-1 ring-foreground/5", className)}>
      {poster ? (
        // A plain <img>: next/image would add its optimiser's widths to pictures already made to size.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={poster.src}
          srcSet={poster.srcSet}
          sizes={poster.srcSet && sizes}
          alt=""
          width={poster.width}
          height={poster.height}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          className={cn("absolute inset-0 size-full object-cover", faded && "saturate-[.55]")}
        />
      ) : (
        <div aria-hidden className={cn("absolute inset-0", faded && "saturate-[.55]")} style={{ background: background.kind === "gradient" ? background.css : undefined }} />
      )}
      {chip && <div className="absolute top-2.5 left-2.5">{chip}</div>}
      {title && (
        <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 via-black/65 via-60% to-transparent px-3 pt-14 pb-3">
          <p
            className={cn(
              "font-title text-xl leading-none text-balance break-words text-white drop-shadow-title",
              TITLE_FONT_CLASSES[theme.font],
              font.className,
              titleClassName,
            )}
          >
            {title}
          </p>
        </div>
      )}
    </div>
  );
}
