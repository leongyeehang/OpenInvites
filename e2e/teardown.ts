import { exec } from "./instances";

// After every run (playwright.config.ts, globalTeardown): the motion jobs a test held as being made
// (instances.ts, holdMotionPending) and could not release because it failed midway, which would
// keep their photos' pages refreshing for ten minutes in the next run.
export default function teardown() {
  exec("db", "psql", "-U", "openinvites", "-d", "openinvites", "-v", "ON_ERROR_STOP=1", "-c", "delete from video_job where leased_by = 'e2e'");
}
