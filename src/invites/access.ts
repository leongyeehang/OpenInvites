// Who is in on an invite-only event (M6 spec, "Who is in"), apart from its hosts, who always are.
// A device is in when it holds a pass for one of the event's invites that still exists, or when the
// invite it stands for, by the invite cookie its personal invite link left or by the reply its RSVP
// cookie holds, has no email: a guest invited by phone or by name alone has nothing to prove but
// their link. An invite with an email is let in by a pass alone, never by its link and never by the
// reply's edit link, so a forwarded link is no use without the inbox.
export function admitted({ pass, invite }: { pass: boolean; invite: { email: string | null } | undefined }): boolean {
  return pass || (invite !== undefined && !invite.email);
}

// Which invite a device stands for (M6 spec, "Who is in"; M6 final review): the invite of its pass,
// with the pass, when it holds one; else the invite the reply it holds is tied to; else the invite
// its invite cookie names. The reply comes before the cookie as the stronger claim: a guest who
// replied and then opened someone else's forwarded link (an invite with an email, which a link
// alone never admits) is still the guest who replied, and is let in as that guest was.
export function standsFor<Invite>({ passed, replied, cookie }: { passed: Invite | undefined; replied: Invite | undefined; cookie: Invite | undefined }): {
  invite: Invite | undefined;
  pass: boolean;
} {
  return passed !== undefined ? { invite: passed, pass: true } : { invite: replied ?? cookie, pass: false };
}
