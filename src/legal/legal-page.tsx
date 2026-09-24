import { getTranslations } from "next-intl/server";
import { operatorContactEmail } from "@/instance/env";
import { legalPageHtml } from "./documents";
import { legalSource, type LegalPage as Page } from "./source";

// A legal page: its title, the operator's text as the operator wrote it (documents.ts), and how
// to reach the operator. The prose is styled here, as it arrives as HTML.
export async function LegalPage({ page }: { page: Page }) {
  const [t, html] = await Promise.all([getTranslations("Legal"), legalPageHtml(page)]);
  const operator = operatorContactEmail();
  // Until the operator writes the page, the reader is told so in their own language; the
  // placeholder under it is for the operator (placeholders.ts).
  const unpublished = legalSource(process.env, page).from === "placeholder";
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">{t(page)}</h1>
      {unpublished && <p className="leading-relaxed font-semibold">{t(`notPublished.${page}`)}</p>}
      <div
        data-slot="legal-text"
        className="leading-relaxed [&_a]:underline [&_a]:underline-offset-4 [&_code]:font-mono [&_code]:text-[0.9em] [&_h1]:mt-8 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-6 [&_h3]:font-semibold [&_li]:mt-2 [&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mt-4 [&_strong]:font-semibold [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-6 [&>:first-child]:mt-0"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <p className="border-t pt-6 text-sm text-muted-foreground">
        {operator
          ? t.rich("contact", {
              email: operator,
              link: (chunks) => (
                <a href={`mailto:${operator}`} className="underline underline-offset-4">
                  {chunks}
                </a>
              ),
            })
          : t("contactUnknown")}
      </p>
    </main>
  );
}
