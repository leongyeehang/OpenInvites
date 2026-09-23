import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalPage } from "@/legal/legal-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Legal");
  return { title: t("privacy") };
}

// The operator's privacy policy (src/legal/), linked from every page's footer.
export default function PrivacyPage() {
  return <LegalPage page="privacy" />;
}
