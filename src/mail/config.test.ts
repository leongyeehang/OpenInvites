import { describe, expect, it } from "vitest";
import { mailConfigFromEnv } from "./config";

describe("mailConfigFromEnv", () => {
  it("reports no mail when SMTP_URL is unset or blank", () => {
    expect(mailConfigFromEnv({})).toBeNull();
    expect(mailConfigFromEnv({ SMTP_URL: "  ", MAIL_FROM: "OpenInvites <no-reply@example.org>" })).toBeNull();
  });

  it("returns the transport URL and sender when both are set", () => {
    expect(
      mailConfigFromEnv({ SMTP_URL: "smtp://mail:1025", MAIL_FROM: "OpenInvites <no-reply@example.org>" }),
    ).toEqual({ smtpUrl: "smtp://mail:1025", from: "OpenInvites <no-reply@example.org>" });
  });

  it("refuses SMTP without a sender address, so the operator finds out at start", () => {
    expect(() => mailConfigFromEnv({ SMTP_URL: "smtp://mail:1025" })).toThrow(/MAIL_FROM/);
  });
});
