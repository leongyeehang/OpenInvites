import { describe, expect, it } from "vitest";
import { ACTIONS, can, roleOf } from "./role";

describe("can", () => {
  it("lets the owner do everything", () => {
    for (const action of ACTIONS) expect(can("owner", action), action).toBe(true);
  });

  it("lets a co-host do everything but delete the event or manage its co-hosts", () => {
    expect(ACTIONS.filter((action) => can("coHost", action))).toEqual([
      "edit",
      "publish",
      "cancel",
      "design",
      "questions",
      "guests",
      "announcements",
      "comments",
      "share",
      "resetLink",
      "duplicate",
    ]);
    expect(can("coHost", "delete")).toBe(false);
    expect(can("coHost", "manageCoHosts")).toBe(false);
  });
});

describe("roleOf", () => {
  const event = { hostId: "0192a7b8-0000-7000-8000-000000000001" };

  it("is the owner for the host who created the event, and a co-host for anyone it answers for", () => {
    expect(roleOf(event, "0192a7b8-0000-7000-8000-000000000001")).toBe("owner");
    expect(roleOf(event, "0192a7b8-0000-7000-8000-000000000002")).toBe("coHost");
  });
});
