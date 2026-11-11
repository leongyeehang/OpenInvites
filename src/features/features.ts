// The site's optional features (M8 spec, "Features are modules inside the app"; ADR-0008): what
// each needs, and whether the operator has it on. The operator switches each on or off for every
// event on Site settings' Features card; a feature that is off is not shown to hosts or guests and
// its actions refuse, but nothing it holds is deleted.

export const FEATURES = ["album", "videos", "voting"] as const;
export type FeatureId = (typeof FEATURES)[number];

// What each feature needs to be on as well: videos and voting are the album's. Videos also need a
// usable ffmpeg, which is the server's to say (album/ffmpeg.ts), not a switch.
export const FEATURE_NEEDS: Record<FeatureId, readonly FeatureId[]> = {
  album: [],
  videos: ["album"],
  voting: ["album"],
};

// The operator's switches, one per feature. A feature the operator never switched is on.
export type FeatureSwitches = Record<FeatureId, boolean>;
export const ALL_ON: FeatureSwitches = { album: true, videos: true, voting: true };

// Whether a feature is on: its own switch, and the switch of everything it needs, all the way down.
export function featureOn(switches: FeatureSwitches, id: FeatureId): boolean {
  return switches[id] && FEATURE_NEEDS[id].every((need) => featureOn(switches, need));
}
