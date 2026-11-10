import { findEventBySlug } from "@/events/repository";
import { baseUrl } from "@/instance/env";
import { gateFor } from "@/invites/gate";
import { albumState, mayAddPhotos, type AlbumViewer } from "./album";
import type { AlbumUpload } from "./repository";
import type { AlbumRefusal } from "./upload-protocol";
import { albumViewer } from "./viewer";

// What every album route checks before anything else (M7 ticket 06; the one post route did the
// same): only the instance's own pages may send one, since the cookies would otherwise ride along
// from anywhere; the event exists and its album is open; on an invite-only event the device is
// in (invites/gate.ts); and the viewer may add. Routes answer a refusal with its JSON, so the
// page can say why.

export type AlbumEvent = NonNullable<Awaited<ReturnType<typeof findEventBySlug>>>;
export type Adder = Exclude<AlbumViewer, { kind: "visitor" }>;

export type AlbumAccess = { ok: true; event: AlbumEvent; viewer: Adder } | { ok: false; response: Response };

export function refusal(error: AlbumRefusal, status: number, headers?: HeadersInit): { ok: false; response: Response } {
  return { ok: false, response: Response.json({ error }, { status, headers }) };
}

export async function albumAccess(request: Request, slug: string): Promise<AlbumAccess> {
  // A browser sends Origin with what changes things, not with a same-origin GET, which here only
  // answers which parts have arrived.
  const changes = request.method !== "GET" && request.method !== "HEAD";
  if (changes && request.headers.get("origin") !== new URL(baseUrl()).origin) return { ok: false, response: new Response(null, { status: 403 }) };
  const event = await findEventBySlug(slug);
  if (!event || albumState(event, new Date()) !== "open") return refusal("closed", 409);
  if ((await gateFor(event)).page !== "invitation") return refusal("closed", 409);
  const viewer = await albumViewer(event.id);
  if (!mayAddPhotos(viewer) || viewer.kind === "visitor") return refusal("notAllowed", 403);
  return { ok: true, event, viewer };
}

// Only the device that asked for an upload sends its parts and finishes it.
export function owns(viewer: Adder, upload: Pick<AlbumUpload, "hostId" | "rsvpId">): boolean {
  return viewer.kind === "host" ? upload.hostId === viewer.hostId : upload.rsvpId === viewer.rsvpId;
}

export const UPLOAD_ID = /^[A-Za-z0-9_-]{24}$/;
