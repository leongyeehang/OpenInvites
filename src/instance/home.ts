import { findGalleryPoster, GALLERY_POSTERS, type GalleryPosterId } from "../themes/posters";

// What the operator sets about the home page, the page at the site's address (spec,
// .scratch/home-page/spec.md): the instance's name and a welcome line under it, which gallery
// posters the page shows, and whether it says who runs the site. Null for the name or the line
// means the operator has not set one, and the page uses its default.

export const DEFAULT_INSTANCE_NAME = "OpenInvites";
export const INSTANCE_NAME_MAX = 40;
export const WELCOME_LINE_MAX = 140;

// Every gallery poster, a different one each visit; only the ones the operator picked; or one poster.
export const HOME_POSTER_MODES = ["all", "picked", "one"] as const;
export type HomePosterMode = (typeof HOME_POSTER_MODES)[number];

export type HomePage = {
  instanceName: string | null;
  welcomeLine: string | null;
  posters: HomePosterMode;
  // The posters of `picked` or `one`; empty with `all`.
  posterIds: GalleryPosterId[];
  showOperator: boolean;
};

export const DEFAULT_HOME_PAGE: HomePage = { instanceName: null, welcomeLine: null, posters: "all", posterIds: [], showOperator: false };

// Text typed into a one-line field: trimmed, every run of whitespace (line breaks included) one
// space, and nothing at all is null.
export function normaliseText(raw: string): string | null {
  const text = raw.trim().replace(/\s+/g, " ");
  return text === "" ? null : text;
}

export type HomePageField = "instanceName" | "welcomeLine" | "posters";
export type HomePageParse =
  | { ok: true; page: HomePage }
  | { ok: false; field: "instanceName" | "welcomeLine"; reason: "tooLong" }
  | { ok: false; field: "posters"; reason: "unknownPoster" | "noneChosen" | "chooseOne" };

const isPosterMode = (value: string): value is HomePosterMode => (HOME_POSTER_MODES as readonly string[]).includes(value);

// Lengths count characters as a person does (code points), so 40 Chinese characters fit.
const tooLong = (text: string | null, max: number) => text !== null && Array.from(text).length > max;

// The form's fields as posted, or the first that is wrong. With `all` the posters are not read, and
// none are stored.
export function parseHomePage(fields: { instanceName: string; welcomeLine: string; posters: string; posterIds: string[]; showOperator: boolean }): HomePageParse {
  const instanceName = normaliseText(fields.instanceName);
  if (tooLong(instanceName, INSTANCE_NAME_MAX)) return { ok: false, field: "instanceName", reason: "tooLong" };
  const welcomeLine = normaliseText(fields.welcomeLine);
  if (tooLong(welcomeLine, WELCOME_LINE_MAX)) return { ok: false, field: "welcomeLine", reason: "tooLong" };
  const { posters, showOperator } = fields;
  if (!isPosterMode(posters)) return { ok: false, field: "posters", reason: "unknownPoster" };
  if (posters === "all") return { ok: true, page: { instanceName, welcomeLine, posters, posterIds: [], showOperator } };

  const posterIds = [...new Set(fields.posterIds)];
  if (!posterIds.every((id) => findGalleryPoster(id))) return { ok: false, field: "posters", reason: "unknownPoster" };
  if (posters === "picked" && posterIds.length === 0) return { ok: false, field: "posters", reason: "noneChosen" };
  if (posters === "one" && posterIds.length !== 1) return { ok: false, field: "posters", reason: "chooseOne" };
  return { ok: true, page: { instanceName, welcomeLine, posters, posterIds: posterIds as GalleryPosterId[], showOperator } };
}

// The posters the home page draws from, in gallery order. A poster that has left the gallery since
// it was chosen is skipped, and a pool left empty is the whole gallery, so the page always has one.
export function posterPool(page: Pick<HomePage, "posters" | "posterIds">): GalleryPosterId[] {
  const everyone = GALLERY_POSTERS.map((poster) => poster.id);
  if (page.posters === "all") return everyone;
  const chosen = everyone.filter((id) => (page.posterIds as string[]).includes(id));
  return chosen.length > 0 ? chosen : everyone;
}

export function instanceDisplayName(page: Pick<HomePage, "instanceName">): string {
  return page.instanceName ?? DEFAULT_INSTANCE_NAME;
}
