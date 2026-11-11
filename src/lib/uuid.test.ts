import { describe, expect, it } from "vitest";
import { isUuid, uuidv7Time } from "./uuid";

describe("uuidv7Time", () => {
  // The first 48 bits of a UUIDv7 are milliseconds since the epoch (M7 ticket 10: how old a
  // file's id is, for the stray-file check).
  it("reads the moment a UUIDv7 was made", () => {
    expect(uuidv7Time("01934e6b-1c2a-7000-8000-000000000000")).toEqual(new Date(0x01934e6b1c2a));
    expect(uuidv7Time("00000000-0000-7000-8000-000000000000")).toEqual(new Date(0));
  });

  it("is nothing for another version, or what is not a UUID", () => {
    expect(uuidv7Time("01934e6b-1c2a-4000-8000-000000000000")).toBeUndefined();
    expect(uuidv7Time("not-an-id")).toBeUndefined();
    expect(uuidv7Time("")).toBeUndefined();
  });

  it("keeps isUuid as it was", () => {
    expect(isUuid("01934e6b-1c2a-7000-8000-000000000000")).toBe(true);
    expect(isUuid("01934e6b-1c2a-7000-8000-00000000000")).toBe(false);
  });
});
