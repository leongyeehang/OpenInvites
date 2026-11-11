import { missingParts } from "@/album/upload-protocol";
import type { AlbumRefusal, AskResponse, FinishResponse, PartResponse } from "@/album/upload-protocol";
import { videoProblem, type VideoCaps } from "@/album/video";
import type { UploadProblem } from "@/uploads/validate";

// The browser's side of the upload protocol (M7 tickets 06 and 07; album/upload-protocol.ts): the
// check before anything is sent, one ask for the batch, then each file's parts in order and its
// finish, two files at a time, with a resume after a dropped connection. What each file became is
// answered in the files' order, as the one post answered it.

export type UploadOutcome = { name: string; ok: true; pending: boolean; kind: "photo" | "video" } | { name: string; ok: false; problem: UploadProblem; max?: number };
export type UploadBatchResult = { error?: AlbumRefusal; left?: number; limit?: number; results?: UploadOutcome[] };

// A file before it is sent: its length, when the browser could read it, and what is wrong with it
// against the event's caps, so a clip over them costs no upload (plan ruling 14: an unknown length
// is sent, and the server judges it).
export type Prepared = { file: File; kind: "photo" | "video"; durationMs: number | undefined; problem?: "tooLarge" | "tooLong" | "videosNotAllowed" };

export async function prepareFiles(files: File[], caps: { maxPhotoBytes: number; video: VideoCaps }): Promise<Prepared[]> {
  return Promise.all(
    files.map(async (file): Promise<Prepared> => {
      if (!file.type.startsWith("video/")) return { file, kind: "photo", durationMs: undefined, problem: file.size > caps.maxPhotoBytes ? "tooLarge" : undefined };
      if (!caps.video.allowed) return { file, kind: "video", durationMs: undefined, problem: "videosNotAllowed" };
      const durationMs = await lengthOf(file);
      return { file, kind: "video", durationMs, problem: videoProblem({ size: file.size, durationMs }, caps.video) };
    }),
  );
}

// A clip's length from an off-screen player, or nothing when this browser cannot read the clip.
function lengthOf(file: File): Promise<number | undefined> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const player = document.createElement("video");
    player.preload = "metadata";
    const done = (length: number | undefined) => {
      URL.revokeObjectURL(url);
      resolve(length);
    };
    player.onloadedmetadata = () => done(Number.isFinite(player.duration) && player.duration > 0 ? Math.round(player.duration * 1000) : undefined);
    player.onerror = () => done(undefined);
    player.src = url;
  });
}

const AT_ONCE = 2;
const RETRIES = 3;
const BACKOFF_MS = [500, 1500, 4000];

// The upload the browser holds for a file, so a pick of the same file after a reload resumes it.
type Held = { id: string; partSize: number };

function heldKey(slug: string, file: File): string {
  return `album-upload:${slug}:${file.name}:${file.size}:${file.lastModified}`;
}

function held(slug: string, file: File): Held | undefined {
  try {
    const value = sessionStorage.getItem(heldKey(slug, file));
    return value ? (JSON.parse(value) as Held) : undefined;
  } catch {
    return undefined;
  }
}

function hold(slug: string, file: File, upload: Held | undefined): void {
  try {
    if (upload) sessionStorage.setItem(heldKey(slug, file), JSON.stringify(upload));
    else sessionStorage.removeItem(heldKey(slug, file));
  } catch {
    // Storage blocked: there is nothing to resume from a reload, and that is all.
  }
}

export async function uploadFiles(slug: string, prepared: Prepared[], onDone?: (index: number, outcome: UploadOutcome) => void): Promise<UploadBatchResult> {
  const base = `/api/albums/${encodeURIComponent(slug)}/uploads`;
  // What a reload left half done is resumed, if the server still has it; the rest is asked for.
  const resumed = await Promise.all(prepared.map(async ({ file }) => (await stillThere(base, held(slug, file))) ?? undefined));
  const asking = prepared.filter((_, index) => !resumed[index]);
  let planned: Extract<AskResponse, { uploads: unknown }>["uploads"] = [];
  if (asking.length > 0) {
    const asked = await fetch(base, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ files: asking.map(({ file, durationMs }) => ({ name: file.name, size: file.size, type: file.type, durationMs })) }),
    });
    const ask = (await asked.json().catch(() => ({}))) as AskResponse | Record<string, never>;
    if (!("uploads" in ask)) return "error" in ask ? (ask as UploadBatchResult) : { error: "failed" };
    planned = ask.uploads;
  }
  const plans = prepared.map((_, index) => resumed[index] ?? planned.shift());

  const results: UploadOutcome[] = new Array(prepared.length);
  let next = 0;
  const worker = async () => {
    while (next < prepared.length) {
      const index = next++;
      const { file, kind } = prepared[index];
      const plan = plans[index];
      let outcome: UploadOutcome;
      if (!plan) outcome = { name: file.name, ok: false, problem: "incomplete" };
      else if (refused(plan)) outcome = { name: file.name, ok: false, problem: plan.problem, ...(plan.max !== undefined && { max: plan.max }) };
      else {
        const upload: Held = accepted(plan) ? { id: plan.id, partSize: plan.partSize } : plan;
        hold(slug, file, upload);
        outcome = await uploadOne(base, file, kind, upload, resumed[index] !== undefined);
        if (outcome.ok || outcome.problem !== "incomplete") hold(slug, file, undefined);
      }
      results[index] = outcome;
      onDone?.(index, outcome);
    }
  };
  await Promise.all(Array.from({ length: Math.min(AT_ONCE, prepared.length) }, worker));
  return { results };
}

type Planned = Extract<AskResponse, { uploads: unknown }>["uploads"][number];
type Plan = Planned | Held;
const accepted = (plan: Plan): plan is Extract<Planned, { ok: true }> => "ok" in plan && plan.ok;
const refused = (plan: Plan): plan is Extract<Planned, { ok: false }> => "ok" in plan && !plan.ok;

async function stillThere(base: string, upload: Held | undefined): Promise<Held | undefined> {
  if (!upload) return undefined;
  const response = await fetch(`${base}/${upload.id}`).catch(() => undefined);
  return response?.ok ? upload : undefined;
}

async function receivedParts(base: string, id: string): Promise<number[] | undefined> {
  const response = await fetch(`${base}/${id}`).catch(() => undefined);
  if (!response?.ok) return undefined;
  return ((await response.json().catch(() => undefined)) as PartResponse | undefined)?.received;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Each part in order; a part that fails is tried again after asking which parts arrived, so a
// connection that dropped mid-way sends only what is missing. An upload resumed from a reload asks
// first, so what a reload left on the server is not sent again.
async function uploadOne(base: string, file: File, kind: "photo" | "video", upload: Held, resumed: boolean): Promise<UploadOutcome> {
  const parts = Math.max(1, Math.ceil(file.size / upload.partSize));
  let todo = missingParts(resumed ? ((await receivedParts(base, upload.id)) ?? []) : [], parts);
  for (let attempt = 0; todo.length > 0; attempt += 1) {
    const failed = await sendParts(base, file, upload, todo);
    if (!failed) break;
    if (attempt >= RETRIES) return { name: file.name, ok: false, problem: "incomplete" };
    await wait(BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)]);
    const received = await receivedParts(base, upload.id);
    if (!received) return { name: file.name, ok: false, problem: "incomplete" };
    todo = missingParts(received, parts);
  }
  const finished = await fetch(`${base}/${upload.id}/finish`, { method: "POST" }).catch(() => undefined);
  const answer = (await finished?.json().catch(() => undefined)) as FinishResponse | undefined;
  if (!answer || !answer.ok) return { name: file.name, ok: false, problem: answer?.problem ?? "incomplete" };
  return { name: file.name, ok: true, pending: answer.item.state === "pending", kind };
}

// The parts given, in order; true when one failed (the sending stops there).
async function sendParts(base: string, file: File, upload: Held, parts: number[]): Promise<boolean> {
  for (const part of parts) {
    const sent = await fetch(`${base}/${upload.id}?part=${part}`, {
      method: "PUT",
      headers: { "content-type": "application/octet-stream" },
      body: file.slice(part * upload.partSize, (part + 1) * upload.partSize),
    }).catch(() => undefined);
    if (!sent?.ok) return true;
  }
  return false;
}
