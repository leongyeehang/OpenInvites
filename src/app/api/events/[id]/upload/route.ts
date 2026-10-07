import { getSession } from "@/auth/session";
import { findHostEvent } from "@/events/repository";
import { can } from "@/hosts/role";
import { baseUrl, maxUploadBytes } from "@/instance/env";
import { isUuid } from "@/lib/uuid";
import { consume, retryAfter } from "@/rate-limit/rate-limit";
import { uploadPicture, type UploadOutcome } from "@/uploads/uploads";

// The Design drawer's upload: the request's body is the picture's bytes, and the answer is the
// new upload's id or what was wrong. A route handler rather than a server action, because a
// server action's body limit is fixed when the app is built (1 MB unless next.config.ts raises
// it), while the operator sets MAX_UPLOAD_MB when the app starts; here the body is read up to
// that limit and no further.
export async function POST(request: Request, context: RouteContext<"/api/events/[id]/upload">) {
  // Only the instance's own pages may send one, as Next.js checks for its server actions: the
  // session cookie would otherwise ride along with a request made from anywhere.
  if (request.headers.get("origin") !== new URL(baseUrl()).origin) return new Response(null, { status: 403 });
  // Counted before the body is read: a picture is held in memory while it is processed.
  const verdict = await consume("upload", request.headers);
  if (!verdict.allowed) return Response.json({ problem: "tooFast" }, { status: 429, headers: retryAfter(verdict) });
  const session = await getSession();
  if (!session) return new Response(null, { status: 401 });
  const { id } = await context.params;
  const event = isUuid(id) ? await findHostEvent(session.user.id, id) : undefined;
  if (!event || !can(event.role, "design")) return refused("notFound");

  const maxBytes = maxUploadBytes();
  const bytes = await readUpTo(request, maxBytes);
  if (!bytes) return refused("tooLarge");
  const outcome = await uploadPicture(session.user.id, id, bytes, maxBytes);
  return outcome.ok ? Response.json({ id: outcome.id }) : refused(outcome.problem);
}

const STATUS = { tooLarge: 413, unsupported: 415, tooManyPixels: 422, notFound: 404 } as const;

function refused(problem: Extract<UploadOutcome, { ok: false }>["problem"]) {
  return Response.json({ problem }, { status: STATUS[problem] });
}

// The request's body, or undefined as soon as it runs past `limit`: a client that says it will
// send more, or sends more than it said, is not read to the end.
async function readUpTo(request: Request, limit: number): Promise<Uint8Array | undefined> {
  if (Number(request.headers.get("content-length")) > limit) return undefined;
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (let read = await reader?.read(); read && !read.done; read = await reader!.read()) {
    size += read.value.byteLength;
    if (size > limit) {
      await reader!.cancel();
      return undefined;
    }
    chunks.push(read.value);
  }
  return Buffer.concat(chunks);
}
