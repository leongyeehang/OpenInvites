import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/auth/session";
import { Button } from "@/components/ui/button";
import { findHostEvent } from "@/events/repository";
import { coHostLinkState } from "@/hosts/co-host-link";
import { findCoHostLink } from "@/hosts/repository";
import { registrationMode } from "@/instance/repository";
import { ClientMessages } from "@/locale/client-messages";
import { AcceptForm } from "./accept-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("CoHostLink");
  return { title: t("title"), robots: { index: false, follow: false } };
}

// Where a co-host link leads (spec, "Co-hosts"): the event's title and, for a signed-in host who
// does not host it yet, the button that makes them a co-host. Opening it changes nothing; only the
// button does, and it posts. The owner is told it is their own event, and a co-host is taken to
// it. A link that is used, revoked or expired says so; one that was never made is answered with
// the not-found page (src/proxy.ts). A visitor who is not signed in is sent to sign in and back,
// and told that the link needs a host account here, which on an invitation-only instance takes a
// host invitation first: the link admits nobody to the instance.
export default async function CoHostLinkPage({ params }: PageProps<"/co-host/[token]">) {
  const { token } = await params;
  const [link, session, t] = await Promise.all([findCoHostLink(token), getSession(), getTranslations("CoHostLink")]);
  if (!link) notFound();
  // What the signed-in host already is to the event, through the one gate (events/repository.ts).
  const hosted = session ? await findHostEvent(session.user.id, link.event.id) : undefined;
  if (hosted?.role === "coHost") redirect(`/events/${link.event.id}`);
  const isOwner = hosted?.role === "owner";
  const state = coHostLinkState(link, new Date());

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-xl flex-col justify-center gap-4 px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">{link.event.title}</h1>
      {isOwner ? (
        <>
          <p className="text-muted-foreground">{t("owner")}</p>
          <Button asChild className="self-start">
            <Link href={`/events/${link.event.id}`}>{t("openEvent")}</Link>
          </Button>
        </>
      ) : state !== "pending" ? (
        <p className="text-muted-foreground">{t(state)}</p>
      ) : session ? (
        <ClientMessages namespaces={["CoHostLink"]}>
          <AcceptForm token={token} />
        </ClientMessages>
      ) : (
        <>
          <Button asChild className="self-start">
            <Link href={`/sign-in?next=${encodeURIComponent(`/co-host/${token}`)}`}>{t("signIn")}</Link>
          </Button>
          <p className="text-sm text-muted-foreground">
            {(await registrationMode()) === "invitationOnly" ? t("needsInvitation") : t("needsAccount")}
          </p>
        </>
      )}
    </main>
  );
}
