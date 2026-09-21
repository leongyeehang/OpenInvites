import { describe, expect, it } from "vitest";
import { withEnglishFallback } from "./fallback";

describe("withEnglishFallback", () => {
  const english = { Home: { title: "OpenInvites", status: "Up." }, EventPage: { when: "When", where: "Where" } };

  it("keeps every translated string and fills gaps from English", () => {
    const merged = withEnglishFallback({ Home: { title: "开放邀请" } }, english);
    expect(merged).toEqual({ Home: { title: "开放邀请", status: "Up." }, EventPage: { when: "When", where: "Where" } });
  });

  it("changes nothing when the locale is complete", () => {
    const full = { Home: { title: "T", status: "S" }, EventPage: { when: "W", where: "H" } };
    expect(withEnglishFallback(full, english)).toEqual(full);
  });
});
