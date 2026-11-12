import type { GalleryPosterId } from "../themes/posters";
import type { ThemeUpload } from "../themes/resolve";
import type { Theme } from "../themes/theme";
import { DEFAULT_HOME_PAGE, homeTheme, posterPool } from "./home";

// Which poster each part of the site that is not an event page wears (M8 spec, "Glass", "Which
// poster"). Every such page sits on a gallery poster, the same one on every visit to its area, so
// that the site looks like the invitations it sends; an event's management pages wear that event's
// own theme.

// The areas that wear a poster of the site's: the signed-out screens and the co-host link
// (`welcome`), the notice pages a guest meets (`guest`), the pages drawn without the database
// (`fallback`), Site settings and reports (`site`), and a host's own pages when they have neither
// picked a poster nor an event to take one from (`host`).
export type SiteArea = "welcome" | "guest" | "fallback" | "site" | "host";

// What the pages drawn without the database draw from: the whole gallery, in gallery order. Not
// found, privacy, terms and too fast are drawn without it, and every 429 is rewritten to too fast,
// which must not cost a query that may fail (src/app/layout.tsx, src/proxy.ts).
export const DBLESS_POOL: readonly GalleryPosterId[] = posterPool(DEFAULT_HOME_PAGE);

// The area's poster from a pool: the same for the same pool and area, and different areas mostly
// apart. A string hash of the area's name (h × 31 + code point, kept to 32 bits) picks it, so it
// needs no state and no randomness. `posterPool` never gives an empty pool; one that is empty all
// the same is the whole gallery, so a page always has a poster.
export function sitePoster(pool: readonly GalleryPosterId[], area: SiteArea): GalleryPosterId {
  const from = pool.length > 0 ? pool : DBLESS_POOL;
  let hash = 0;
  for (const character of area) hash = (hash * 31 + character.codePointAt(0)!) % 2 ** 32;
  return from[hash % from.length];
}

// A gallery poster as a site page wears it: as the home page does, with no effect.
export function siteTheme(id: GalleryPosterId): Theme {
  return homeTheme(id);
}

// What a page outside an event page is painted with: a theme, and the upload when the theme's
// poster is one (only an event's, on its management pages or as a host's glow).
export type SiteLook = { theme: Theme; upload: ThemeUpload | null };

export function areaLook(pool: readonly GalleryPosterId[], area: SiteArea): SiteLook {
  return { theme: siteTheme(sitePoster(pool, area)), upload: null };
}

// An event's look outside its own page: its theme and upload, held still (nothing on a page
// outside an event page moves).
export function eventLook(theme: Theme, upload: ThemeUpload | null): SiteLook {
  return { theme: { ...theme, effect: "none" }, upload };
}

// A host's own pages (dashboard, account, new event): the poster they picked; else the look of
// their next event, as the dashboard's glow used; else the host area's poster from the site's set.
export function hostLookOf({ pick, glow, pool }: { pick: GalleryPosterId | null; glow: SiteLook | null; pool: readonly GalleryPosterId[] }): SiteLook {
  if (pick !== null) return { theme: siteTheme(pick), upload: null };
  return glow ?? areaLook(pool, "host");
}
