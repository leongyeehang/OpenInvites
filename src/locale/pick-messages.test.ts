import { describe, expect, it } from "vitest";
import { pickMessages } from "./pick-messages";

describe("pickMessages", () => {
  const messages = {
    Rsvp: { going: "Going", maybe: "Maybe" },
    Events: { form: { title: "Title" }, share: { copy: "Copy" }, manage: { delete: "Delete" } },
    Footer: { privacy: "Privacy" },
  };

  it("keeps the namespaces named, whole, and nothing else", () => {
    expect(pickMessages(messages, ["Rsvp"])).toEqual({ Rsvp: { going: "Going", maybe: "Maybe" } });
  });

  it("keeps a part of a namespace where a component reads only that part, beside its siblings asked for", () => {
    expect(pickMessages(messages, ["Events.form", "Events.manage", "Footer"])).toEqual({
      Events: { form: { title: "Title" }, manage: { delete: "Delete" } },
      Footer: { privacy: "Privacy" },
    });
  });

  it("keeps nothing when nothing is named", () => {
    expect(pickMessages(messages, [])).toEqual({});
  });
});
