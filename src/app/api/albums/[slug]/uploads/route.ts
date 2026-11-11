import { randomBytes } from "node:crypto";
import { albumAccess, refusal } from "@/album/access";
import { ffmpegStatus } from "@/album/ffmpeg";
import { reserveUploads, type AskedFile } from "@/album/repository";
import { kindOf, parseAskRequest, partBytes, type AskResponse } from "@/album/upload-protocol";
import { effectiveVideoCaps, videoProblem } from "@/album/video";
import { featureOn, siteFeatures } from "@/features";
import { instanceLimits } from "@/instance/repository";
import { MEGABYTE } from "@/lib/sizes";
import { consume, retryAfter } from "@/rate-limit/rate-limit";
import { freeDiskBytes } from "@/storage/usage";
import type { UploadProblem } from "@/uploads/validate";

// The ask (M7 ticket 06; album/upload-protocol.ts): a batch of up to ten files, each judged by
// what the browser said of it (a photo over Largest photo, a video on an event that takes none or
// over its caps), the rest reserved in the album at once, all or none. One ask counts once against
// the upload limit; the parts and the finishes count nothing. The ids the browser then holds are
// random, not the time-ordered ids items get, so one upload cannot be guessed from another.
export async function POST(request: Request, context: RouteContext<"/api/albums/[slug]/uploads">) {
  const { slug } = await context.params;
  const access = await albumAccess(request, slug);
  if (!access.ok) return access.response;
  const verdict = await consume("upload", request.headers);
  if (!verdict.allowed) return refusal("tooFast", 429, retryAfter(verdict)).response;
  const ask = parseAskRequest(await request.json().catch(() => undefined));
  if (!ask) return refusal("failed", 400).response;

  const { event, viewer } = access;
  const [limits, switches] = await Promise.all([instanceLimits(), siteFeatures()]);
  const caps = { maxItems: limits.maxPhotosPerEvent, maxEventBytes: limits.maxEventStorageMb * MEGABYTE, maxSiteBytes: limits.maxSiteStorageMb * MEGABYTE };
  const video = effectiveVideoCaps(event, {
    maxVideoMb: limits.maxVideoMb,
    maxVideoMinutes: limits.maxVideoMinutes,
    videosAvailable: ffmpegStatus().available,
    videosOn: featureOn(switches, "videos"),
  });
  const maxPhotoBytes = limits.maxPhotoMb * MEGABYTE;
  const partSize = partBytes();
  const token = () => randomBytes(18).toString("base64url");

  const judged = ask.files.map((file) => {
    const kind = kindOf(file.type);
    const problem: UploadProblem | undefined =
      kind === "video" ? (video.allowed ? videoProblem(file, video) : "videosNotAllowed") : file.size > maxPhotoBytes ? "tooLarge" : undefined;
    // The cap a refusal applied, for the page to name: bytes for a size, milliseconds for a length.
    const max = problem === "tooLarge" ? (kind === "video" ? video.maxBytes : maxPhotoBytes) : problem === "tooLong" ? video.maxMs : undefined;
    return { file, kind, problem, max, id: token() };
  });
  const accepted = judged.filter((each) => each.problem === undefined);
  if (accepted.length > 0) {
    const owner = viewer.kind === "host" ? { hostId: viewer.hostId } : { rsvpId: viewer.rsvpId };
    const files: AskedFile[] = accepted.map(({ file, kind, id }) => ({ id, name: file.name, size: file.size, type: file.type, kind, durationMs: file.durationMs, partSize }));
    const reserved = await reserveUploads(event.id, owner, token(), files, caps, await freeDiskBytes());
    if ("refused" in reserved) {
      return Response.json({ error: reserved.refused.error, left: reserved.refused.left, limit: reserved.refused.limit } satisfies AskResponse, { status: 409 });
    }
  }
  return Response.json({
    uploads: judged.map(({ file, kind, problem, max, id }) =>
      problem ? { ok: false as const, name: file.name, problem, ...(max !== undefined && { max }) } : { ok: true as const, id, name: file.name, partSize, kind },
    ),
  } satisfies AskResponse);
}
