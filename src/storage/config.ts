// Where uploaded files live (ADR-0003): on local disk by default, which is a Docker volume in
// the image, or in S3-compatible object storage when the operator says so. Every setting is an
// environment variable (spec, "Operator configuration").
export type StorageConfig =
  | { backend: "local"; dir: string }
  | { backend: "s3"; endpoint: string; region: string; bucket: string; accessKey: string; secretKey: string };

export function storageConfigFromEnv(env: Record<string, string | undefined>): StorageConfig {
  const backend = env.STORAGE_BACKEND?.trim() || "local";
  // Relative to the working directory: /app/uploads in the image.
  if (backend === "local") return { backend, dir: env.UPLOADS_DIR?.trim() || "uploads" };
  if (backend !== "s3") throw new Error(`STORAGE_BACKEND must be "local" or "s3", not "${backend}"`);

  const required = (name: string) => {
    const value = env[name]?.trim();
    if (!value) throw new Error(`${name} must be set when STORAGE_BACKEND is s3`);
    return value;
  };
  return {
    backend,
    endpoint: required("S3_ENDPOINT"),
    region: env.S3_REGION?.trim() || "us-east-1",
    bucket: required("S3_BUCKET"),
    accessKey: required("S3_ACCESS_KEY_ID"),
    secretKey: required("S3_SECRET_ACCESS_KEY"),
  };
}

export function storageConfig(): StorageConfig {
  return storageConfigFromEnv(process.env);
}
