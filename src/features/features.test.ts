import { describe, expect, it } from "vitest";
import { ALL_ON, FEATURE_NEEDS, FEATURES, featureOn, type FeatureSwitches } from "./features";

// The site's optional features and the operator's switches (M8 ticket 01, ADR-0008).

describe("the feature list", () => {
  it("names the album, videos and voting", () => {
    expect(FEATURES).toEqual(["album", "videos", "voting"]);
  });

  it("says what each needs: videos and voting need the album, which needs nothing", () => {
    expect(FEATURE_NEEDS.album).toEqual([]);
    expect(FEATURE_NEEDS.videos).toEqual(["album"]);
    expect(FEATURE_NEEDS.voting).toEqual(["album"]);
  });

  it("needs only features it names, never itself", () => {
    for (const id of FEATURES) {
      for (const need of FEATURE_NEEDS[id]) {
        expect(FEATURES).toContain(need);
        expect(need).not.toBe(id);
      }
    }
  });
});

describe("featureOn", () => {
  it("is on for every feature when every switch is", () => {
    for (const id of FEATURES) expect(featureOn(ALL_ON, id)).toBe(true);
  });

  it("is off for the album and everything that needs it when the album is switched off", () => {
    const switches: FeatureSwitches = { ...ALL_ON, album: false };
    expect(featureOn(switches, "album")).toBe(false);
    expect(featureOn(switches, "videos")).toBe(false);
    expect(featureOn(switches, "voting")).toBe(false);
  });

  it("is off for videos alone when videos are switched off", () => {
    const switches: FeatureSwitches = { ...ALL_ON, videos: false };
    expect(featureOn(switches, "album")).toBe(true);
    expect(featureOn(switches, "videos")).toBe(false);
    expect(featureOn(switches, "voting")).toBe(true);
  });

  it("is off for voting alone when voting is switched off", () => {
    const switches: FeatureSwitches = { ...ALL_ON, voting: false };
    expect(featureOn(switches, "album")).toBe(true);
    expect(featureOn(switches, "videos")).toBe(true);
    expect(featureOn(switches, "voting")).toBe(false);
  });
});
