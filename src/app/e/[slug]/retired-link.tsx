import { getTranslations } from "next-intl/server";

// A link the host has reset. It used to work, which is a different thing from never having
// existed, and saying so saves the guest wondering whether they mistyped it.
export async function RetiredLink() {
  const t = await getTranslations("EventPage");
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-xl flex-col justify-center gap-3 px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">{t("retiredTitle")}</h1>
      <p className="text-muted-foreground">{t("retired")}</p>
    </main>
  );
}
