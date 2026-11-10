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

