import { describe, expect, it } from "vitest";
import { nextPath } from "./next-path";

describe("nextPath", () => {
  it("keeps a path on this instance", () => {
    expect(nextPath("/co-host/Zm9vYmFyYmF6cXV4cXV1eGNvcmdl")).toBe("/co-host/Zm9vYmFyYmF6cXV4cXV1eGNvcmdl");
    expect(nextPath("/events/0192a7b8-0000-7000-8000-000000000001?tab=1")).toBe("/events/0192a7b8-0000-7000-8000-000000000001?tab=1");
  });

  it("sends anything else to the dashboard, so the sign-in never leads off the instance", () => {
    for (const value of [
      undefined,
      null,
      ["/co-host/a", "/co-host/b"],
      "",
      "/",
      "co-host/a",
      "https://elsewhere.example/",
      "javascript:alert(1)",
      "//elsewhere.example",
      "/\\elsewhere.example",
      "/\telsewhere.example",
      "/\n/elsewhere.example",
      "/co-host//elsewhere.example",
      " /co-host/a",
    ]) {
      expect(nextPath(value), JSON.stringify(value)).toBe("/dashboard");
    }
  });
});
