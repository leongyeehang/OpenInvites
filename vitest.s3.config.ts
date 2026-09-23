import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// The S3 smoke test (src/storage/s3.smoke.ts), kept out of `pnpm test` because it needs a server:
// `docker compose --profile s3 up -d --wait && pnpm test:s3`. CI runs it on every push. The
// settings are the Compose `s3` profile's.
export default defineConfig({
  test: {
    include: ["src/**/*.smoke.ts"],
    env: {
      STORAGE_BACKEND: "s3",
      S3_ENDPOINT: "http://localhost:7070",
      S3_BUCKET: "openinvites",
      S3_ACCESS_KEY_ID: "openinvites",
      S3_SECRET_ACCESS_KEY: "s3-profile-only-secret",
    },
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
