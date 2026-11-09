import { describe, expect, it } from "vitest";
import { editTokenThroughInvite, generateEditToken, hashEditToken } from "./token";

// M6 ticket 08: a device that holds a reply only through the invite it is tied to holds the reply's
// edit token only when the invite's token is it, as for a reply saved through the invite. A reply
// made before its invite keeps an edit token of its own, which the device does not have.
describe("editTokenThroughInvite", () => {
  it("is the invite's token when the reply was saved through the invite", () => {
    const token = generateEditToken();
    expect(editTokenThroughInvite(token, { editTokenHash: hashEditToken(token) })).toBe(token);
  });

  it("is none when the reply was made before its invite, with an edit token of its own", () => {
    const own = generateEditToken();
    expect(editTokenThroughInvite(generateEditToken(), { editTokenHash: hashEditToken(own) })).toBeNull();
  });
});
