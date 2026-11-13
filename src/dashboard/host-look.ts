import { cache } from "react";
import { listHostEvents } from "@/events/repository";
import { findHostLook } from "@/hosts/look";
import { posterPool } from "@/instance/home";
import { homePage } from "@/instance/repository";
import { eventLook, hostLookOf, type SiteLook } from "@/instance/site-look";
import { NO_RSVPS } from "@/rsvps/counts";
import { findEventUploads } from "@/uploads/repository";
import { themeUpload } from "@/uploads/uploads";
import { glowEvent, shelve } from "./shelves";

// The look a host's pages wear (M8 spec, "Glass", "Which poster"): the poster the host picked in
// Account's Backdrop card (ticket 22); else the look of the event that lent the dashboard its glow,
// Next up's or else the first on the page, held still; else the host area's poster from the site's
// set. Which event is Next up does not depend on its replies or its deletion date (shelves.ts), so
// neither is read, and with a pick the event's upload is not either. Cached, so that the frame reads
// it once a request.
export const hostLook = cache(async (hostId: string): Promise<SiteLook> => {
  const [pick, events, home] = await Promise.all([findHostLook(hostId), listHostEvents(hostId), homePage()]);
  const lending = glowEvent(shelve(events.map((event) => ({ ...event, counts: NO_RSVPS, deletion: null })), new Date()));
  let glow: SiteLook | null = null;
  if (lending && pick === null) {
    const upload = lending.theme.poster.kind === "upload" ? (await findEventUploads([lending.id])).get(lending.id) : undefined;
    glow = eventLook(lending.theme, upload ? themeUpload(upload) : null);
  }
  return hostLookOf({ pick, glow, pool: posterPool(home) });
});
