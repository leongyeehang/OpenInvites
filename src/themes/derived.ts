import type { Background } from "./backgrounds";
import { hexToRgb, luma } from "./legibility";
import type { ThemeUpload } from "./resolve";

// Two backgrounds made from the host's picture (spec, "Derived backgrounds"), offered in the
// gallery after it while the event has one. They are not curated data: nothing is stored or
// measured for them. Each is worked out from what the server already keeps for the picture
// (uploads/sample.ts, uploads/renditions.ts), and the theme names it in `backgroundId` as it
// names a curated one.
export const DERIVED_BACKGROUND_IDS = ["upload-blur", "upload-wash"] as const;

export type DerivedBackgroundId = (typeof DERIVED_BACKGROUND_IDS)[number];

export function isDerivedBackground(id: string | null): id is DerivedBackgroundId {
  return DERIVED_BACKGROUND_IDS.includes(id as DerivedBackgroundId);
}

// Soft blur is the picture's small copy, blurred by the page as it is behind a poster
// (themed-page.tsx), so it carries the extremes measured for that copy under that blur and the
// poster's scrim. Colour wash is a gradient from the picture's darkest point through its accent to
// its lightest. Its luminance is the mean of its stops', measured as every background's is (luma),
// so the automatic text tone reads it as it reads the picture. Its extremes are its stops, the
// ones with the highest and lowest luminance, whatever the sample calls them: under their scrims a
// dark picture's lightest point can be darker than its darkest, and its accent brighter than both.
export function derivedBackground(id: DerivedBackgroundId, { accent, luminance, lightest, darkest, poster }: ThemeUpload): Background {
  if (id === "upload-blur") {
    return { id, kind: "photo", src: poster.copySrc, accent, luminance, lightest: poster.lightest, darkest: poster.darkest, blurred: true };
  }
  const stops = [darkest, accent, lightest].map((colour) => ({ colour, luminance: luma(hexToRgb(colour)) }));
  const [low, , high] = [...stops].sort((a, b) => a.luminance - b.luminance);
  return {
    id,
    kind: "gradient",
    css: `linear-gradient(135deg, ${stops.map((stop) => stop.colour).join(", ")})`,
    accent,
    luminance: stops.reduce((sum, stop) => sum + stop.luminance, 0) / stops.length,
    lightest: high.colour,
    darkest: low.colour,
  };
}

// What a guest's page is sent of the picture while it wears a background made from it
// (app/e/[slug]/page.tsx). The picture itself is put aside, the host's alone, so its sources, its
// description and its id stay out: what is left is its sampled colours and, for Soft blur, the
// small copy the page blurs. Nothing on the page reads the rest while the picture is put aside.
export function derivedUpload(upload: ThemeUpload, id: DerivedBackgroundId): ThemeUpload {
  const copySrc = id === "upload-blur" ? upload.poster.copySrc : "";
  return {
    ...upload,
    id: "",
    src: "",
    portraitSrc: "",
    thumbnailSrc: "",
    altText: "",
    poster: { ...upload.poster, src: "", srcSet: undefined, copySrc },
  };
}
