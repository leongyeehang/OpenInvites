import { describe, expect, it } from "vitest";
import { storageConfigFromEnv } from "./config";

const S3 = {
  STORAGE_BACKEND: "s3",
  S3_ENDPOINT: "https://s3.eu-central-1.amazonaws.com",
  S3_BUCKET: "openinvites-uploads",
  S3_ACCESS_KEY_ID: "AKIAEXAMPLE",
  S3_SECRET_ACCESS_KEY: "secret",
};

describe("storageConfigFromEnv", () => {
  it("keeps uploads on local disk when nothing is set, in the uploads directory", () => {
    expect(storageConfigFromEnv({})).toEqual({ backend: "local", dir: "uploads" });
    expect(storageConfigFromEnv({ STORAGE_BACKEND: " " })).toEqual({ backend: "local", dir: "uploads" });
  });

  it("puts local uploads where the operator says", () => {
    expect(storageConfigFromEnv({ STORAGE_BACKEND: "local", UPLOADS_DIR: "/data/uploads" })).toEqual({ backend: "local", dir: "/data/uploads" });
  });

  it("uses S3-compatible storage with its endpoint, bucket and keys, in us-east-1 unless told otherwise", () => {
    expect(storageConfigFromEnv(S3)).toEqual({
      backend: "s3",
      endpoint: "https://s3.eu-central-1.amazonaws.com",
      region: "us-east-1",
      bucket: "openinvites-uploads",
      accessKey: "AKIAEXAMPLE",
      secretKey: "secret",
    });
    expect(storageConfigFromEnv({ ...S3, S3_REGION: "eu-central-1" })).toMatchObject({ region: "eu-central-1" });
  });

  it("refuses S3 with a setting missing, so the operator finds out at start", () => {
    for (const name of ["S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"]) {
      expect(() => storageConfigFromEnv({ ...S3, [name]: "" }), name).toThrow(name);
    }
  });

  it("refuses a backend it does not know", () => {
    expect(() => storageConfigFromEnv({ STORAGE_BACKEND: "ftp" })).toThrow(/STORAGE_BACKEND/);
  });
});
