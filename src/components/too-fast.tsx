import { getTranslations } from "next-intl/server";

// What a request refused by the rate limits is shown in place of the page it asked for.
export async function TooFast() {
  const t = await getTranslations("TooFast");
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-xl flex-col justify-center gap-3 px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="text-muted-foreground">{t("text")}</p>
    </main>
  );
}
