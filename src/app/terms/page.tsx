import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalPage } from "@/legal/legal-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Legal");
  return { title: t("terms") };
}

// The operator's terms of use (src/legal/), linked from every page's footer.
export default function TermsPage() {
  return <LegalPage page="terms" />;
}
