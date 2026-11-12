import { getTranslations } from "next-intl/server";
import { posterPool } from "@/instance/home";
import { homePage } from "@/instance/repository";
import { areaLook } from "@/instance/site-look";
import { ClientMessages } from "@/locale/client-messages";
import { Glass } from "@/themes/glass";
import { SitePage } from "@/themes/site-page";
import { turnstileSiteKey } from "@/turnstile/config";
import { LockedForm } from "./locked-form";

// What an invite-only event shows a device that is not in (M6 spec, "The locked page"): nothing of
// the event but its host's name. It wears the site's backdrop, the guest area's poster from the
// site's set, never the event's Theme, so it reads the same whatever the host chose (M8 spec,
// "Glass", "Which poster"). The invited prove the email the host invited them with by a code sent to
// it; the email is filled in, and kept as it is, when this device opened the personal invite link
// of an invite with one. Without mail no code can be sent, and the page only says to ask the host.
export async function LockedPage({ slug, host, email, mail }: { slug: string; host: string; email: string | null; mail: boolean }) {
  const [t, page] = await Promise.all([getTranslations("InviteOnly"), homePage()]);
  return (
    <SitePage look={areaLook(posterPool(page), "guest")}>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
        <Glass className="flex flex-col gap-8 p-6">
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
        </Glass>
      </main>
    </SitePage>
  );
}
