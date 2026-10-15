import type { LegalPage } from "./source";

// What each legal page says until the operator provides their own text (source.ts), under the
// sentence that tells the reader it is not written yet (legal-page.tsx, Legal.notPublished, in
// the reader's language). This part is for the operator: how to write the page, and what such a
// page usually covers on an instance of this software, in the glossary's words. Markdown, like
// the operator's own, and in English, like the operator documentation.
export const PLACEHOLDERS: Record<LegalPage, string> = {
  privacy: [
    "To the operator: this is the placeholder OpenInvites ships. Replace it with your own policy, written in Markdown, by setting `PRIVACY_POLICY_FILE` to the path of a file you mount, or `PRIVACY_POLICY_MARKDOWN` to the text itself. The address in `OPERATOR_CONTACT_EMAIL` is shown under it.",
    "",
    "A privacy policy for an instance usually covers:",
    "",
    "- **Who is responsible**: your name or your organisation's, and where you are.",
    "- **What the instance keeps**. For hosts: their display name, their email address, their password (stored as a hash), their events, and the pictures they upload. For guests: what they give when they reply, which is their name, the names of anyone they bring, their answers to the host's questions, and an email address when the host asks for one; and the comments they post on the event page.",
    "- **What a guest's email address is used for**: mail about the event they replied to, which is the notice if it is cancelled, the hosts' announcements, and reminders before it. Every such email ends with a link that stops email about the event. Mail waiting to be sent holds its recipient's address for up to about an hour and a half, until it is sent or dropped.",
    "- **Cookies**: one that keeps a host signed in, one that remembers the chosen language, one per event that lets a guest's device find their RSVP again, and one that holds a host invitation while its holder signs up.",
    "- **Who else sees it**: the event's hosts, the host who made it and any co-hosts, see every RSVP and every answer to their questions; guests see the guest list when the hosts allow it; comments are shown to the hosts and to guests who have replied; and the hosts see how many times the event page was opened, not by whom. Name the services the instance relies on, such as its hosting provider, its mail provider, storage for uploads if they are kept elsewhere, and any analytics you have added.",
    "- **Visitors' network addresses**: the instance holds them in memory to limit how often one address can use it, for an hour at most with the default limits, and records them nowhere. Your reverse proxy may keep logs of its own.",
    "- **How long things are kept and how to have them removed**: hosts can delete their events and their account, and guests can remove their RSVP with their edit link.",
    "- **Who to contact** with questions or requests about personal data.",
  ].join("\n"),
  terms: [
    "To the operator: this is the placeholder OpenInvites ships. Replace it with your own terms, written in Markdown, by setting `TERMS_FILE` to the path of a file you mount, or `TERMS_MARKDOWN` to the text itself. The address in `OPERATOR_CONTACT_EMAIL` is shown under it.",
    "",
    "Terms of use for an instance usually cover:",
    "",
    "- **Who runs the instance, and who may host on it**: anyone who signs up, or only people you give a host invitation to.",
    "- **What hosts may not do**, such as sending event links to people who did not ask for them, using guests' details for anything but the event, or uploading pictures they have no right to share.",
    "- **What you promise and what you do not**: whether the instance may be down, change, or close, and how much notice hosts get.",
    "- **What happens to accounts and events that break the terms**, and how a host can leave.",
    "- **Which law applies**, and how to get in touch.",
  ].join("\n"),
};
