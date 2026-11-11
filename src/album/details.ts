// What processing learns of an item beyond its size and length, kept in `photo.details` (M8
// ticket 05): a video's HDR kind and its frame rate, which the player's HDR mark (ticket 06) and
// the technical line read. Ticket 07 adds the capture time, camera and exposure. The stored files
// keep none of it: processing drops every piece of metadata, so this is all that is left.
export type ItemDetails = { hdr?: "hlg" | "pq"; fps?: number };

// A video is HDR when its transfer is HLG (what an iPhone records, Dolby Vision's base layer
// included) or PQ, in ffprobe's words; anything else is standard colour.
export function hdrKind(colorTransfer: string | undefined): "hlg" | "pq" | undefined {
  if (colorTransfer === "arib-std-b67") return "hlg";
  if (colorTransfer === "smpte2084") return "pq";
  return undefined;
}

// A frame rate in ffprobe's words ("30000/1001", "60/1", or a bare number), to two decimals;
// nothing for one it could not tell ("0/0").
export function frameRate(rate: string | undefined): number | undefined {
  const match = /^(\d+(?:\.\d+)?)(?:\/(\d+(?:\.\d+)?))?$/.exec(rate ?? "");
  if (!match) return undefined;
  const fps = Number(match[1]) / Number(match[2] ?? 1);
  return Number.isFinite(fps) && fps > 0 ? Math.round(fps * 100) / 100 : undefined;
}

// The column read back: only the keys and values written here are kept, so a row written by a
// later version, or by hand, never reaches a page as something it is not.
export function readDetails(raw: unknown): ItemDetails {
  if (typeof raw !== "object" || raw === null) return {};
  const { hdr, fps } = raw as Record<string, unknown>;
  return {
    ...(hdr === "hlg" || hdr === "pq" ? { hdr } : {}),
    ...(typeof fps === "number" && Number.isFinite(fps) && fps > 0 ? { fps } : {}),
  };
}
