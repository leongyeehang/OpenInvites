import { cache } from "react";
import { getDb } from "@/db/client";
import { instanceFeature } from "@/db/schema";
import { ALL_ON, FEATURES, type FeatureId, type FeatureSwitches } from "./features";

// The operator's switches, as stored (features/features.ts): every feature on, then each row the
// operator saved. A row whose id is no longer a feature is passed over. Cached per request, as the
// limits are: the page and the checks that act on a switch may both ask.
export const siteFeatures = cache(async (): Promise<FeatureSwitches> => {
  const rows = await getDb().select({ id: instanceFeature.id, enabled: instanceFeature.enabled }).from(instanceFeature);
  const switches = { ...ALL_ON };
  for (const row of rows) {
    const id = FEATURES.find((each) => each === row.id);
    if (id) switches[id] = row.enabled;
  }
  return switches;
});

export async function setFeature(id: FeatureId, on: boolean): Promise<void> {
  await getDb()
    .insert(instanceFeature)
    .values({ id, enabled: on })
    .onConflictDoUpdate({ target: instanceFeature.id, set: { enabled: on, updatedAt: new Date() } });
}
