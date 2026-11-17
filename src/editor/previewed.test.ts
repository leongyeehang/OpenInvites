import { describe, expect, it } from "vitest";
import type { Switches } from "@/sections";
import { previewedSections } from "./previewed";

const ON: Switches = { lettersEnabled: true, commentsEnabled: true, guestListVisibility: "afterReply", albumEnabled: true };

describe("the sections the editor previews", () => {
  it("previews every section that is on", () => {
    expect(Object.keys(previewedSections(ON, { album: true }, true)).sort()).toEqual(["album", "announcements", "comments", "countdown", "details", "guests", "letter", "schedule"]);
  });

  // Ticket 28: an event with no date yet has nothing to count to.
  it("previews the countdown only for an event with a date", () => {
    expect(previewedSections(ON, { album: true }, false)).not.toHaveProperty("countdown");
  });

  // Ticket 29's review focus: an album opens at the event's start, so an event with no date yet
  // has none on its guests' page, nor in the editor's preview.
  it("previews the album only for an event with a date", () => {
    expect(previewedSections(ON, { album: true }, false)).not.toHaveProperty("album");
  });

  it("leaves out a section whose column is off", () => {
    const shown = previewedSections({ lettersEnabled: false, commentsEnabled: false, guestListVisibility: "hidden", albumEnabled: false }, { album: true }, true);
    expect(Object.keys(shown).sort()).toEqual(["announcements", "countdown", "details", "schedule"]);
  });

  // Review of ticket 25: the guest's page has no album while the operator has it off, so neither
  // does the editor's preview, whatever the event's own switch says.
  it("previews the album only while both the site and the event have it on", () => {
    expect(previewedSections(ON, { album: false }, true)).not.toHaveProperty("album");
    expect(previewedSections({ ...ON, albumEnabled: false }, { album: true }, true)).not.toHaveProperty("album");
    expect(previewedSections(ON, { album: true }, true)).toHaveProperty("album");
    // A feature not said to be on is not offered (the part review's finding 5).
    expect(previewedSections(ON, {}, true)).not.toHaveProperty("album");
  });
});
