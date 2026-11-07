// Who is in on an invite-only event (M6 spec, "Who is in"), apart from its hosts, who always are.
// A device is in when it holds a pass for one of the event's invites that still exists, or when the
// invite it stands for, by the invite cookie its personal invite link left or by the reply its RSVP
// cookie holds, has no email: a guest invited by phone or by name alone has nothing to prove but
// their link. An invite with an email is let in by a pass alone, never by its link and never by the
// reply's edit link, so a forwarded link is no use without the inbox.
export function admitted({ pass, invite }: { pass: boolean; invite: { email: string | null } | undefined }): boolean {
  return pass || (invite !== undefined && !invite.email);
}
