import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { posterPool } from "@/instance/home";
import { homePage } from "@/instance/repository";
import { areaLook } from "@/instance/site-look";
import { ClientMessages } from "@/locale/client-messages";
import { findByMailToken } from "@/rsvps/repository";
import { Glass } from "@/themes/glass";
import { SitePage } from "@/themes/site-page";
import { StopForm } from "./stop-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("StopMail");
  return { title: t("title"), robots: { index: false, follow: false } };
}

// Where the link at the foot of every email to a guest leads (spec, "Guest mail"), in the language
// of whoever opens it: the event, the email on file, and one button that stops mail about the
// event. Opening it changes nothing, as mail clients open links before anyone reads them; only the
// button does, and it posts. The token is an RSVP's, a date poll voter's or, at the foot of an
// invitation, an invite's (M6 ticket 06); one that none of them has is answered with the not-found
// page (src/proxy.ts). One whose email is already blank says there is nothing to stop; an invite
// whose guest has stopped mail keeps its email, and says the mail is stopped
// (invites/repository.ts, findInviteByMailToken). It wears the guest area's poster from the site's
// set (instance/site-look.ts), never the event's Theme.
export default async function StopMailPage({ params }: PageProps<"/m/[token]">) {
  const { token } = await params;
  const [found, t, page] = await Promise.all([findByMailToken(token), getTranslations("StopMail"), homePage()]);
  if (!found) notFound();
  return (
    <SitePage look={areaLook(posterPool(page), "guest")}>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-12">
        <Glass className="flex flex-col gap-4 p-6">
          <h1 className="text-3xl font-semibold tracking-tight">{found.title}</h1>
          {found.stopped ? (
            <p className="text-muted-foreground">{t("stopped")}</p>
          ) : found.email ? (
            <ClientMessages namespaces={["StopMail"]}>
              <StopForm token={token} email={found.email} />
            </ClientMessages>
          ) : (
            <p className="text-muted-foreground">{t("noEmail")}</p>
          )}
        </Glass>
      </main>
    </SitePage>
  );
}
