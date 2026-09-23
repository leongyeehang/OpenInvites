import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { analyticsHead } from "@/components/analytics";
import { AnalyticsFallback } from "@/components/analytics-fallback";
import { PageFooter } from "@/components/page-footer";
import { analyticsSnippet } from "@/instance/env";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Home");
  return { title: t("title"), description: t("tagline") };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const analytics = analyticsSnippet();
  return (
    <html lang={locale}>
      {/* The operator's analytics snippet, as they gave it, and only when they gave one
          (components/analytics.ts). It is the head's content as the server writes it, with the
          tags Next.js puts beside it, so on hydration the head holds more than the snippet:
          nothing is wrong, and React never rewrites it, as the snippet does not change. */}
      {analytics && <head suppressHydrationWarning dangerouslySetInnerHTML={{ __html: analyticsHead(analytics) }} />}
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
        <PageFooter />
        {analytics && <AnalyticsFallback snippet={analytics} />}
      </body>
    </html>
  );
}
