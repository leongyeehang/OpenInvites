import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ClientMessages } from "@/locale/client-messages";
import { findByMailToken } from "@/rsvps/repository";
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
// (invites/repository.ts, findInviteByMailToken).
export default async function StopMailPage({ params }: PageProps<"/m/[token]">) {
  const { token } = await params;
  const [found, t] = await Promise.all([findByMailToken(token), getTranslations("StopMail")]);
  if (!found) notFound();
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-xl flex-col justify-center gap-4 px-4 py-12">
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
    </main>
  );
}
