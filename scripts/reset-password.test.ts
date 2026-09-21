import { verifyPassword } from "better-auth/crypto";
import { describe, expect, it } from "vitest";
import { generateTemporaryPassword, hashPassword } from "./reset-password.mjs";

describe("operator password reset", () => {
  it("stores a hash that Better Auth accepts at sign-in", async () => {
    const hash = hashPassword("correct horse battery staple");
    expect(await verifyPassword({ hash, password: "correct horse battery staple" })).toBe(true);
    expect(await verifyPassword({ hash, password: "wrong" })).toBe(false);
  });

  it("issues a temporary password long enough for Better Auth and free of look-alike characters", () => {
    const password = generateTemporaryPassword();
    expect(password).toMatch(/^[a-kmnp-z2-9]{16}$/);
    expect(generateTemporaryPassword()).not.toBe(password);
  });
});
