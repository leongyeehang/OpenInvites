import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import type { EventState } from "@/events/repository";

export async function EventStateBadge({ state }: { state: EventState }) {
  const t = await getTranslations("Events.state");
  const variant = state === "published" ? "default" : state === "cancelled" ? "destructive" : "secondary";
  return <Badge variant={variant}>{t(state)}</Badge>;
}
