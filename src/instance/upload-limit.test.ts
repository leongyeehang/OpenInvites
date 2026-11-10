import { describe, expect, it } from "vitest";
import { photoLimitFromEnv } from "./upload-limit";

// MAX_UPLOAD_MB retires in 0.7 (M7 ticket 01): its value is read once into Largest photo.
describe("photoLimitFromEnv", () => {
  it("is 40 MB when the setting is unset or blank", () => {
    expect(photoLimitFromEnv(undefined)).toBe(40);
    expect(photoLimitFromEnv("")).toBe(40);
    expect(photoLimitFromEnv("   ")).toBe(40);
  });

  it("takes the number the operator set, rounded up to a whole megabyte", () => {
    expect(photoLimitFromEnv("10")).toBe(10);
    expect(photoLimitFromEnv(" 25 ")).toBe(25);
    expect(photoLimitFromEnv("0.5")).toBe(1);
    expect(photoLimitFromEnv("12.2")).toBe(13);
  });

  it("clamps to the Largest photo range", () => {
    expect(photoLimitFromEnv("5000")).toBe(1000);
  });

  it("falls back to 40 MB on anything that is not a positive number", () => {
    expect(photoLimitFromEnv("abc")).toBe(40);
    expect(photoLimitFromEnv("0")).toBe(40);
    expect(photoLimitFromEnv("-3")).toBe(40);
  });
});
