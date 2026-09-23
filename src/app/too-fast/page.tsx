import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { TooFast } from "@/components/too-fast";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("TooFast");
  return { title: t("title"), robots: { index: false, follow: false } };
}

// What a page request refused by the rate limits gets (src/proxy.ts), with 429 and Retry-After.
export default function TooFastPage() {
  return <TooFast />;
}
