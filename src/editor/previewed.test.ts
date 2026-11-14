import { describe, expect, it } from "vitest";
import type { Switches } from "@/sections";
import { previewedSections } from "./previewed";

const ON: Switches = { lettersEnabled: true, commentsEnabled: true, guestListVisibility: "afterReply", albumEnabled: true };

describe("the sections the editor previews", () => {
  it("previews every section that is on, and never the countdown", () => {
    expect(Object.keys(previewedSections(ON, { album: true })).sort()).toEqual(["album", "announcements", "comments", "details", "guests", "letter", "schedule"]);
  });

  it("leaves out a section whose column is off", () => {
    const shown = previewedSections({ lettersEnabled: false, commentsEnabled: false, guestListVisibility: "hidden", albumEnabled: false }, { album: true });
    expect(Object.keys(shown).sort()).toEqual(["announcements", "details", "schedule"]);
  });

  // Review of ticket 25: the guest's page has no album while the operator has it off, so neither
  // does the editor's preview, whatever the event's own switch says.
  it("previews the album only while both the site and the event have it on", () => {
    expect(previewedSections(ON, { album: false })).not.toHaveProperty("album");
    expect(previewedSections({ ...ON, albumEnabled: false }, { album: true })).not.toHaveProperty("album");
    expect(previewedSections(ON, { album: true })).toHaveProperty("album");
  });
});
