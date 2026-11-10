import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// The uploads route against a directory of its own (M7 ticket 04): whole, by range, past the end,
// and HEAD. The storage is chosen from the environment on first use, so it is set before the
// route is loaded.
const ID = "01a1c35d-c209-7f5d-a62a-9ee0f812c233";
const BYTES = Uint8Array.from({ length: 5000 }, (_, at) => (at * 3) % 256);

let dir: string;
let route: typeof import("./route");

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "openinvites-route-"));
  await writeFile(join(dir, `${ID}-photo.webp`), BYTES);
  process.env.STORAGE_BACKEND = "local";
  process.env.UPLOADS_DIR = dir;
  route = await import("./route");
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

const context = (id: string, file: string) => ({ params: Promise.resolve({ id, file }) });
const get = (file: string, headers: Record<string, string> = {}, id = ID) => route.GET(new Request(`http://site/uploads/${id}/${file}`, { headers }), context(id, file));

describe("the uploads route", () => {
  it("serves a stored file whole, with its length and that ranges are taken", async () => {
    const response = await get("photo.webp");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/webp");
    expect(response.headers.get("content-length")).toBe("5000");
    expect(response.headers.get("accept-ranges")).toBe("bytes");
    expect(response.headers.get("cache-control")).toContain("immutable");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(BYTES);
  });

  it("serves a range with 206 and the bytes asked for", async () => {
    const response = await get("photo.webp", { Range: "bytes=100-199" });
    expect(response.status).toBe(206);
    expect(response.headers.get("content-range")).toBe("bytes 100-199/5000");
    expect(response.headers.get("content-length")).toBe("100");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(BYTES.subarray(100, 200));
  });

  it("answers 416 past the end, and 404 for a file that is not there or a name it does not serve", async () => {
    const past = await get("photo.webp", { Range: "bytes=5000-" });
    expect(past.status).toBe(416);
    expect(past.headers.get("content-range")).toBe("bytes */5000");
    expect((await get("photo-thumb.webp")).status).toBe(404);
    expect((await get("video-sent")).status).toBe(404);
    // A video's files are served by name once stored (ticket 05); the clip as sent never is.
    expect((await get("video.mp4")).status).toBe(404);
    expect((await get("photo.webp", {}, "not-a-uuid")).status).toBe(404);
  });

  it("answers HEAD with the headers and no body", async () => {
    const response = await route.HEAD(new Request(`http://site/uploads/${ID}/photo.webp`), context(ID, "photo.webp"));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-length")).toBe("5000");
    expect(response.body).toBeNull();
  });
});
