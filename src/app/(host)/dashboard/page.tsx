import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireHost } from "@/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Host.dashboard");
  return { title: t("title") };
}

// Upcoming and past events arrive with ticket 05; until then the dashboard is the signed-in landing page.
export default async function DashboardPage() {
  await requireHost();
  const t = await getTranslations("Host.dashboard");
  return (
    <section className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="text-muted-foreground">{t("empty")}</p>
    </section>
  );
}
