import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
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
import { findHostEvent, type HostEvent } from "@/events/repository";
import { formatMoment } from "@/events/time";
import { can } from "@/hosts/role";
import { deleteInviteAction } from "@/invites/actions";
import { awaitsInvitation, canMailInvite, inviteState, inviteUrl, MAX_INVITES, MAX_LETTER, roomForInvite } from "@/invites/invite";
import { listInvites, type ListedInvite } from "@/invites/repository";
import { ClientMessages } from "@/locale/client-messages";
import { translatorFor } from "@/locale/messages";
import { isMailConfigured } from "@/mail/config";
import { CopyInviteLink } from "./copy-invite-link";
import { InviteForm, PasteInvites } from "./invite-form";
import { LetterField } from "./letter-field";
import { LettersSwitch } from "./letters-switch";
import { SendInvite, SendUnsentInvites } from "./send-invite";
import { ShareInviteLink } from "./share-invite-link";

// The page's heading, where the focus goes once an invite is deleted, since its Delete button goes
// with it.
const HEADING = "invites-heading";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Invites");
  return { title: t("title") };
}

// The host's personal invites for one event (spec, "Personal invite links"), its invite list (M6
// spec): whether the host writes each guest a letter, the form that makes one invite for a named
// guest and the box that makes several from pasted lines, up to the most an event can have, then
// every invite, newest first, with its email and phone, how it stands, its link to copy or share
// while nobody has replied through it, the way to delete it, and its letter while letters are on.
// With mail, while the event is published, the invitation can be emailed to each guest with an
// email who has not stopped mail, or to all of them not yet sent at once (M6 spec, "The invitation
// email").
export default async function InvitesPage({ params }: PageProps<"/events/[id]/invites">) {
  const [host, { id }, t, locale] = await Promise.all([requireHost(), params, getTranslations("Invites"), getLocale()]);
  const event = await findHostEvent(host.id, id);
  if (!event || !can(event.role, "guests")) notFound();
  const [invites, theirs] = await Promise.all([listInvites(event.id), translatorFor(event.locale)]);
  // Without mail there is no sending at all; a draft's or a cancelled event's links do not open
  // the event page for a guest, so its invitations wait for it to be published.
  const mail = isMailConfigured();
  const sending = mail && event.state === "published";
  const anyMailable = invites.some(canMailInvite);
  // What a share sheet sends with the link: the invitation's subject, in the event's language as
  // the email is, from the host sharing it.
  const shared = { title: event.title, text: theirs("Mail.invitation.subject", { host: host.name, title: event.title }) };

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
        <LettersSwitch eventId={event.id} on={event.lettersEnabled} />
        {roomForInvite(invites.length) ? (
          <>
            <InviteForm eventId={event.id} letters={event.lettersEnabled} maxLetter={MAX_LETTER} />
            <PasteInvites eventId={event.id} />
          </>
        ) : (
          <p className="text-sm">{t("full", { max: MAX_INVITES })}</p>
        )}
        {sending && anyMailable && <SendUnsentInvites eventId={event.id} count={invites.filter(awaitsInvitation).length} />}
        {mail && !sending && anyMailable && <p className="text-sm text-muted-foreground">{t("sendWhenPublished")}</p>}
        {invites.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {invites.map((each) => (
              <li key={each.id} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                <InviteRow event={event} invite={each} sending={sending} shared={shared} locale={locale} />
              </li>
            ))}
          </ul>
        )}
      </ClientMessages>
    </>
  );
}

async function InviteRow({
  event,
  invite,
  sending,
  shared,
  locale,
}: {
  event: HostEvent;
  invite: ListedInvite;
  sending: boolean;
  shared: { title: string; text: string };
  locale: string;
}) {
  const t = await getTranslations("Invites");
  const eventId = event.id;
  const state = inviteState(invite);
  const link = inviteUrl(invite.token);
  // The guest's name names the row's letter field and its button, as every row has them.
  const nameId = `invite-${invite.id}-name`;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <p id={nameId} className="font-medium break-words">
            {invite.name}
          </p>
          {invite.email && <p className="text-sm break-all text-muted-foreground">{invite.email}</p>}
          {invite.phone && <p className="text-sm break-all text-muted-foreground">{invite.phone}</p>}
        </div>
        <div className="flex flex-wrap gap-1">
          <Badge variant={state === "replied" ? "default" : state === "opened" ? "secondary" : "outline"}>
            {state === "replied" && invite.status ? t("state.replied", { status: t(`status.${invite.status}`) }) : t(`state.${state}`)}
          </Badge>
          {/* The guest used the stop link at the foot of an invitation: nothing more is sent. */}
          {invite.mailStoppedAt && <Badge variant="outline">{t("stopped")}</Badge>}
        </div>
      </div>
      {invite.sentAt && (
        <p className="text-sm text-muted-foreground">
          <time dateTime={invite.sentAt.toISOString()}>{t("sentAt", { date: formatMoment(invite.sentAt, event.timeZone, locale) })}</time>
        </p>
      )}
      {/* The link is the guest's to reply with; once they have, it is their edit link, theirs alone. */}
      {state !== "replied" && <p className="font-mono text-sm break-all">{link}</p>}
      <div className="flex flex-wrap gap-2">
        {state !== "replied" && <CopyInviteLink link={link} name={invite.name} />}
        {state !== "replied" && <ShareInviteLink link={link} name={invite.name} {...shared} />}
        {sending && canMailInvite(invite) && <SendInvite eventId={eventId} inviteId={invite.id} name={invite.name} again={invite.sentAt !== null} />}
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
      {event.lettersEnabled && <LetterField eventId={eventId} inviteId={invite.id} letter={invite.letter} nameId={nameId} maxLetter={MAX_LETTER} />}
    </div>
  );
}
