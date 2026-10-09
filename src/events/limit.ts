import { atLimit } from "@/instance/limits";
import { instanceLimits } from "@/instance/repository";
import { countOwnedEvents } from "./repository";

// How many events the host owns when that is as many as the operator allows, so that the refusal
// can say it; nothing when they may make another.
export async function eventsOwnedAtLimit(hostId: string): Promise<number | undefined> {
  const [limits, owned] = await Promise.all([instanceLimits(), countOwnedEvents(hostId)]);
  return atLimit(owned, limits.maxEventsPerHost) ? owned : undefined;
}
