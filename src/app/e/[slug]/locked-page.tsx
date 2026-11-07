import { getTranslations } from "next-intl/server";
import { ClientMessages } from "@/locale/client-messages";
import { turnstileSiteKey } from "@/turnstile/config";
import { LockedForm } from "./locked-form";

// What an invite-only event shows a device that is not in (M6 spec, "The locked page"): a plain
// page, as the "not ready" page is, never the event's theme, and nothing of the event but its
// host's name. The invited prove the email the host invited them with by a code sent to it; the
// email is filled in, and kept as it is, when this device opened the personal invite link of an
// invite with one. Without mail no code can be sent, and the page only says to ask the host.
export async function LockedPage({ slug, host, email, mail }: { slug: string; host: string; email: string | null; mail: boolean }) {
  const t = await getTranslations("InviteOnly");
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center gap-8 px-4 py-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-lg break-words text-muted-foreground">{t("from", { host })}</p>
      </div>
      {mail && (
        <ClientMessages namespaces={["InviteOnly", "Turnstile"]}>
          <LockedForm slug={slug} email={email} turnstileSiteKey={turnstileSiteKey()} />
        </ClientMessages>
      )}
      <p className="text-sm text-muted-foreground">{t("lost")}</p>
    </main>
  );
}
