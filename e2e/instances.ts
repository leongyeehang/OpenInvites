import { execFileSync } from "node:child_process";

// Recreates these containers of the Compose test profile and waits until they are healthy. An
// instance whose database container is among them starts empty: that database lives in memory.
export function recreate(...services: string[]) {
  execFileSync("docker", ["compose", "--profile", "test", "up", "-d", "--force-recreate", "--no-deps", "--wait", ...services], {
    stdio: "pipe",
  });
}
