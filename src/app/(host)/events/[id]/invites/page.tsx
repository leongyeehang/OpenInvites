import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireHost } from "@/auth/session";
import { DeleteDialogContent } from "@/components/delete-dialog-content";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { findHostEvent } from "@/events/repository";
import { can } from "@/hosts/role";
import { deleteInviteAction } from "@/invites/actions";
import { inviteState, inviteUrl, MAX_INVITES, roomForInvite } from "@/invites/invite";
import { listInvites, type ListedInvite } from "@/invites/repository";
import { ClientMessages } from "@/locale/client-messages";
import { CopyInviteLink } from "./copy-invite-link";
import { InviteForm } from "./invite-form";

// The page's heading, where the focus goes once an invite is deleted, since its Delete button goes
// with it.
const HEADING = "invites-heading";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Invites");
  return { title: t("title") };
}

// The host's personal invites for one event (spec, "Personal invite links"): the form that makes one
// for a named guest, up to the most an event can have, then every invite, newest first, with how it
// stands, its link to copy while nobody has replied through it, and the way to delete it.
export default async function InvitesPage({ params }: PageProps<"/events/[id]/invites">) {
  const [host, { id }, t] = await Promise.all([requireHost(), params, getTranslations("Invites")]);
  const event = await findHostEvent(host.id, id);
  if (!event || !can(event.role, "guests")) notFound();
  const invites = await listInvites(event.id);

  return (
    <>
      <div className="flex flex-col gap-1">
        <Link href={`/events/${event.id}`} className="text-sm text-muted-foreground hover:underline">
          {t("backToEvent")}
        </Link>
        <h1 id={HEADING} tabIndex={-1} className="text-2xl font-semibold tracking-tight outline-none">
          {t("title")}
        </h1>
      </div>
      <p className="text-muted-foreground">{t("explainer")}</p>

      <ClientMessages namespaces={["Invites"]}>
        {roomForInvite(invites.length) ? <InviteForm eventId={event.id} /> : <p className="text-sm">{t("full", { max: MAX_INVITES })}</p>}
        {invites.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {invites.map((each) => (
              <li key={each.id} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                <InviteRow eventId={event.id} invite={each} />
              </li>
            ))}
          </ul>
        )}
      </ClientMessages>
    </>
  );
}

async function InviteRow({ eventId, invite }: { eventId: string; invite: ListedInvite }) {
  const t = await getTranslations("Invites");
  const state = inviteState(invite);
  const link = inviteUrl(invite.token);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <p className="font-medium break-words">{invite.name}</p>
          {invite.email && <p className="text-sm break-all text-muted-foreground">{invite.email}</p>}
        </div>
        <Badge variant={state === "replied" ? "default" : state === "opened" ? "secondary" : "outline"}>
          {state === "replied" && invite.status ? t("state.replied", { status: t(`status.${invite.status}`) }) : t(`state.${state}`)}
        </Badge>
      </div>
      {/* The link is the guest's to reply with; once they have, it is their edit link, theirs alone. */}
      {state !== "replied" && <p className="font-mono text-sm break-all">{link}</p>}
      <div className="flex flex-wrap gap-2">
        {state !== "replied" && <CopyInviteLink link={link} name={invite.name} />}
        {/* Deleting cannot be undone, so it is confirmed. */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" aria-label={t("deleteLabel", { name: invite.name })}>
              {t("delete")}
            </Button>
          </AlertDialogTrigger>
          <DeleteDialogContent focusAfter={HEADING}>
            <form action={deleteInviteAction.bind(null, eventId, invite.id)}>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("deleteTitle", { name: invite.name })}</AlertDialogTitle>
                <AlertDialogDescription>{t("deleteText")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="pt-4">
                <AlertDialogCancel type="button">{t("keep")}</AlertDialogCancel>
                <Button type="submit" variant="destructive">
                  {t("deleteConfirm")}
                </Button>
              </AlertDialogFooter>
            </form>
          </DeleteDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
