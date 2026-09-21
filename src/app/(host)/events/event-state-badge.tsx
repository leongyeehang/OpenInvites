import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import type { EventState } from "@/events/repository";

export async function EventStateBadge({ state }: { state: EventState }) {
  const t = await getTranslations("Events.state");
  return <Badge variant={state === "published" ? "default" : "secondary"}>{t(state)}</Badge>;
}
