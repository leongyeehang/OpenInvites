import { execFileSync } from "node:child_process";

// Recreates these containers of the Compose test profile and waits until they are healthy. An
// instance whose database container is among them starts empty: that database lives in memory,
// and the uploads volume app-fresh shares with worker-fresh (M7 ticket 08) is emptied with it, so
// no file from an earlier run outlives the rows that named it.
export function recreate(...services: string[]) {
  execFileSync("docker", ["compose", "--profile", "test", "up", "-d", "--force-recreate", "--no-deps", "--wait", ...services], {
    stdio: "pipe",
  });
  if (services.includes("db-fresh")) exec("app-fresh", "sh", "-c", "rm -rf /app/uploads/* /app/uploads/.[!.]* 2>/dev/null; true");
}

// Runs a command in one of the profile's containers, as the container's own user, and gives its
// output; a command that fails throws (M7 ticket 10 plants and checks files in the uploads volume).
export function exec(service: string, ...command: string[]): string {
  return execFileSync("docker", ["compose", "--profile", "test", "exec", "-T", service, ...command], { stdio: "pipe" }).toString();
}

// A photo's motion held as being made (media part review): a `motion` job on it under a lease that
// no processor holds, which no queue claims for ten minutes (jobs.ts, LEASE_MS), so the pages that
// follow it keep refreshing however busy or idle the queue is. Gives back its release.
export function holdMotionPending(photoId: string): () => void {
  if (!/^[0-9a-f-]{36}$/.test(photoId)) throw new Error(`not an item's id: ${photoId}`);
  const sql = (statement: string) => exec("db", "psql", "-U", "openinvites", "-d", "openinvites", "-v", "ON_ERROR_STOP=1", "-c", statement);
  sql(`insert into video_job (photo_id, work, leased_at, leased_by) values ('${photoId}', 'motion', now(), 'e2e')`);
  return () => void sql(`delete from video_job where photo_id = '${photoId}' and leased_by = 'e2e'`);
}

// What ffprobe says of a served video's first video stream (M8 ticket 03), read in one of the
// profile's containers, which carry ffmpeg where this machine may not, from the bytes on stdin.
// ffprobe stops reading once it has the streams, so the rest of stdin is drained after it, or
// sending it would break the pipe.
export type ServedStream = { codec_name: string; width: number; height: number; pix_fmt: string; color_transfer?: string; color_primaries?: string; avg_frame_rate: string };

export function probeServed(bytes: Buffer, service = "app"): ServedStream {
  const probe = "ffprobe -v error -select_streams v:0 -show_streams -of json -i pipe:0; status=$?; cat > /dev/null; exit $status";
  const out = execFileSync("docker", ["compose", "--profile", "test", "exec", "-T", service, "sh", "-c", probe], { input: bytes, stdio: "pipe" });
  return (JSON.parse(out.toString()) as { streams: ServedStream[] }).streams[0];
}
