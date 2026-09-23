// The sizes a host's picture is kept in (spec, "Uploads and images"). The file they sent is
// never kept: only these, re-encoded from it.
export const RENDITIONS = {
  // The full-page background, large enough for a wide screen, in a format every browser shows.
  background: { file: "background.webp", type: "image/webp" },
  // The link's preview card, at the card's own size (sharing/preview-card.tsx), as a JPEG:
  // next/og draws PNG, JPEG and GIF, not WebP.
  card: { file: "card.jpg", type: "image/jpeg" },
} as const;

export type RenditionName = keyof typeof RENDITIONS;

export const RENDITION_NAMES = Object.keys(RENDITIONS) as RenditionName[];

// Where a rendition is kept: one flat name per file, so the local directory holds nothing else.
export function renditionKey(uploadId: string, name: RenditionName): string {
  return `${uploadId}-${RENDITIONS[name].file}`;
}

// Where the page asks for it. Every upload has a new id, so what is behind a URL never changes.
export function renditionUrl(uploadId: string, name: RenditionName): string {
  return `/uploads/${uploadId}/${RENDITIONS[name].file}`;
}

export function renditionNamed(file: string): RenditionName | undefined {
  return RENDITION_NAMES.find((name) => RENDITIONS[name].file === file);
}
