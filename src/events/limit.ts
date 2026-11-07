import { cache } from "react";
import { atLimit } from "@/instance/limits";
import { instanceLimits } from "@/instance/repository";
import { countOwnedEvents } from "./repository";

// How many events the host owns when that is as many as the operator allows, so that the refusal
// can say it; nothing when they may make another. Asked once per request: the header and the
// dashboard both want it on every dashboard load.
export const eventsOwnedAtLimit = cache(async (hostId: string): Promise<number | undefined> => {
  const [limits, owned] = await Promise.all([instanceLimits(), countOwnedEvents(hostId)]);
  return atLimit(owned, limits.maxEventsPerHost) ? owned : undefined;
});
