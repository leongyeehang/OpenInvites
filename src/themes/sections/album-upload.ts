import type { AlbumRefusal, AskResponse, FinishResponse } from "@/album/upload-protocol";
import type { UploadProblem } from "@/uploads/validate";

// The browser's side of the upload protocol (M7 ticket 06; album/upload-protocol.ts): one ask for
// the batch, then each file's parts in order and its finish, two files at a time. What each file
// became is answered in the files' order, as the one post answered it.

export type UploadOutcome = { name: string; ok: true; pending: boolean } | { name: string; ok: false; problem: UploadProblem };
export type UploadBatchResult = { error?: AlbumRefusal; left?: number; limit?: number; results?: UploadOutcome[] };

const AT_ONCE = 2;

export async function uploadFiles(slug: string, files: File[], lengths: Map<File, number | undefined> = new Map()): Promise<UploadBatchResult> {
  const base = `/api/albums/${encodeURIComponent(slug)}/uploads`;
  const asked = await fetch(base, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ files: files.map((file) => ({ name: file.name, size: file.size, type: file.type, durationMs: lengths.get(file) })) }),
  });
  const ask = (await asked.json().catch(() => ({}))) as AskResponse | Record<string, never>;
  if (!("uploads" in ask)) return "error" in ask ? (ask as UploadBatchResult) : { error: "failed" };

  const results: UploadOutcome[] = new Array(files.length);
  let next = 0;
  const worker = async () => {
    while (next < files.length) {
      const index = next++;
      const file = files[index];
      const planned = ask.uploads[index];
      results[index] = planned?.ok ? await uploadOne(base, file, planned) : { name: file.name, ok: false, problem: planned?.problem ?? "incomplete" };
    }
  };
  await Promise.all(Array.from({ length: Math.min(AT_ONCE, files.length) }, worker));
  return { results };
}

async function uploadOne(base: string, file: File, planned: { id: string; partSize: number }): Promise<UploadOutcome> {
  const parts = Math.max(1, Math.ceil(file.size / planned.partSize));
  for (let part = 0; part < parts; part += 1) {
    const sent = await fetch(`${base}/${planned.id}?part=${part}`, {
      method: "PUT",
      headers: { "content-type": "application/octet-stream" },
      body: file.slice(part * planned.partSize, (part + 1) * planned.partSize),
    });
    if (!sent.ok) return { name: file.name, ok: false, problem: "incomplete" };
  }
  const finished = await fetch(`${base}/${planned.id}/finish`, { method: "POST" });
  const answer = (await finished.json().catch(() => undefined)) as FinishResponse | undefined;
  if (!answer || !answer.ok) return { name: file.name, ok: false, problem: answer?.problem ?? "incomplete" };
  return { name: file.name, ok: true, pending: answer.item.state === "pending" };
}
