# 04: Storage: files stream in and out, and the uploads route serves byte ranges

**What to build:** The storage interface learns to write from a stream and to read a byte range as a stream, on local disk and on S3. The `/uploads/{id}/{file}` route streams every file instead of reading it whole, answers `Range` requests with `206`, and has an explicit `HEAD`. Ships on its own: photos and posters are served this way at once; videos use it from ticket 06.

**Blocked by:** 02 Storage: every upload records its size (for `stat`)

**Status:** done

- [x] `src/storage/storage.ts:8-16` gains `putStream(key: string, body: ReadableStream<Uint8Array>, size: number): Promise<void>` and `stream(key: string, range?: { start: number; end: number }): Promise<ReadableStream<Uint8Array> | undefined>` (`end` inclusive; undefined when nothing is stored under the key). The comment at `:5-7` says keys are flat names and what is stored is bytes; extend it in the same voice.
- [x] Disk (`src/storage/disk.ts`): `putStream` pipes `Readable.fromWeb(body)` into `createWriteStream(path(\`${key}.partial\`))` (passes the `KEY` rule at `:7`) and `rename`s onto `path(key)` when done, so a reader never sees a half-written file; `stream` stats first (ENOENT → undefined) and returns `Readable.toWeb(createReadStream(path(key), range && { start: range.start, end: range.end }))`.
- [x] S3 (`src/storage/s3.ts`): `putStream` is `client.putObject(key, body, { size, partSize: 8 * 1024 * 1024 })`: the client's default part is 64 MiB with four in flight, about 256 MiB of heap per upload; 8 MiB keeps it near 32 MiB and still reaches 80 GB; `stream` is `(await client.getPartialObject(key, range ? { offset: range.start, length: range.end - range.start + 1 } : { offset: 0, length: 0 })).body`, 404 → undefined as `get` does. A range past the end makes S3 answer 416 and the client throw, so the route clamps against `stat` first.
- [x] `src/storage/range.ts` (pure, `range.test.ts`): `parseRange(header: string | null, size: number): { start: number; end: number } | "unsatisfiable" | undefined`: one `bytes=a-b`, `bytes=a-` or `bytes=-n` (the last n bytes), clamped to `size - 1`; `undefined` for no header or a multi-range header (the route then sends the whole file with `200`); `"unsatisfiable"` when `a >= size` or the header is malformed. Tests: each form, the clamp, `bytes=0-` on a 1-byte file, `-0`, `bytes=5-2`, two ranges, size 0.
- [x] `src/app/uploads/[id]/[file]/route.ts` (today `:10-25` reads the whole file): a `fileNamed(file): { key: (id) => string; type: string } | undefined` lookup over the renditions (`src/uploads/renditions.ts`) and the photo files (`src/album/files.ts:20-22`), which ticket 05 extends with the video files; `GET`: `isUuid` → `stat` → 404 when missing; `parseRange(request.headers.get("range"), size)`: `"unsatisfiable"` → `416` with `Content-Range: bytes */{size}`; a range → `206` with `Content-Range: bytes {start}-{end}/{size}`, `Content-Length: end - start + 1` and `stream(key, range)` as the body; none → `200` with `Content-Length: size` and `stream(key)`. Always `Accept-Ranges: bytes`, `Cache-Control: public, max-age=31536000, immutable`, `X-Content-Type-Options: nosniff`, `Content-Type` from the lookup. An explicit `export async function HEAD` answers the same headers with no body: Next otherwise implements HEAD by calling GET, which would open a stream for nothing. Route Handlers return `new Response(readableStream, …)` per `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`, "Streaming".
- [x] `src/app/e/[slug]/preview.png/route.tsx:35` keeps `readRendition` through `get` (satori needs the bytes); nothing else reads files whole after this ticket except the pipelines that process them.
- [x] Tests: `src/storage/s3.smoke.ts` adds `putStream` of a stream over 8 MiB (a multipart upload) read back equal, `stream` with a range returning exactly those bytes, and `stream`/`stat` of a missing key → undefined; `src/storage/disk.test.ts` (ticket 02) gains the same three on `mkdtemp`; `range.test.ts`. Browser (`e2e/uploads.spec.ts`, beside `:81-82`): a poster rendition with `Range: bytes=0-99` answers `206`, a 100-byte body and `Content-Range: bytes 0-99/{size}`; `Range: bytes={size}-` answers `416`; `HEAD` answers `200` with `Content-Length` and an empty body; the existing content-type and cache-control assertions still pass. `e2e/album.spec.ts:86,95,106` (404 after delete) still pass.

## Notes for the implementer

- `compress: true` in `next.config.ts` does not touch `video/mp4` or `image/webp`, so ranges are served as they are; never serve a video as `application/octet-stream`.
- The S3 route path costs a HEAD and a GET per request; that is accepted for a private bucket served by the app (ADR-0003).
- Commit subject, e.g. `Storage: files stream, and the uploads route serves byte ranges`.

## Comments

**2026-11-09, implementing session (native).** Done. `putStream` and `stream` on the storage interface, on disk (a `.partial` file renamed onto the key; `createReadStream` with the range) and on S3 (`putObject` from the stream with 8 MiB parts; `getPartialObject` with the offset and length, the whole file asked for plainly); `src/storage/range.ts` (`parseRange`, unit-tested); the uploads route rewritten: `fileNamed` over the renditions and the photo files, `stat` for the size, `206` with `Content-Range` and `Content-Length` for a range, `416` past the end, `200` with `Content-Length` otherwise, `Accept-Ranges: bytes` always, and an explicit `HEAD`; `photoKey` exported from `album/files.ts` and the whole-file `readPhotoFile` removed (the route was its only reader); the smoke test streams 9 MiB in nine pieces and reads ranges back.

How it landed:
- A route unit test, `src/app/uploads/[id]/[file]/route.test.ts`, drives `GET` and `HEAD` against a temporary directory (whole, a range, past the end, a missing file, a name it does not serve, a bad id). Added while debugging the run below; it stays.
- The DOM typings know neither `ReadableStream.from` nor async iteration, so the tests build streams from pieces and read them with a reader.
- The first browser run failed 34 tests for a reason outside the code: this machine's disk had reached 100% (Docker's build cache from the per-ticket rebuilds), so the free-disk rule of ticket 02 refused every upload, as it should. Pruning the build cache and dangling images freed 41 GB; the rebuilt profile passed everything.

Things to know:
- `preview.png` still reads the card rendition whole through `get`, since satori needs the bytes.
- On S3 a ranged request costs a HEAD and a GET; accepted for a private bucket served by the app.

Evidence: `pnpm lint`, `pnpm typecheck`, `pnpm test` (99 files, 1,021 tests, the route test among them) pass. Against the Docker test profile rebuilt with the change: `e2e/uploads.spec.ts` (with `Accept-Ranges`, `206` and 100 bytes for `bytes=0-99`, `416` past the end, `HEAD` with the length and no body), `e2e/album.spec.ts`, `e2e/album-settings.spec.ts` and `e2e/poster.spec.ts`: 43 passed on both widths in 6.0 min. The smoke test's streaming lines run in CI's S3 job.
