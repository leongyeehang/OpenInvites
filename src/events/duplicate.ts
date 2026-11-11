import type { Locale } from "@/locale/resolve-locale";
import type { Question, QuestionInput } from "@/questions/question";
import type { Theme } from "@/themes/theme";
import type { Event, NewEvent } from "./repository";

// What a duplicate starts from: the details, look, settings and questions of the event it copies,
// and nothing that belongs to that event alone: its state (the copy is a draft), link, replies,
// answers, comments, announcements, co-hosts, views, reminder and retention marks, and publication
// date. Nor its schedule (M6 spec, "The schedule"): the copy has none, and its pages refresh as a
// new event's do, every minute (schedule_refresh's default). Nor its invites: the copy keeps
// personal letters and invite-only as they were, with an invite list of its own to make (M6 spec,
// "Invite-only events"). When to be reminded about the album travels with the settings, though
// not that the source's hosts were (M7 ticket 09). The theme is copied whole: its poster names the event's own picture, not
// the source's, and the copy gets a picture of its own (uploads/copy.ts). The title says it is a
// copy, in the words of the host who duplicates it.
export function duplicateInput(
  source: Event,
  questions: Question[],
  locale: Locale,
  copySuffix: string,
): { event: NewEvent & { theme: Theme }; questions: QuestionInput[] } {
  return {
    event: {
      title: `${source.title} ${copySuffix}`,
      startsAt: source.startsAt,
      endsAt: source.endsAt,
      allDay: source.allDay,
      timeZone: source.timeZone,
      location: source.location,
      description: source.description,
      descriptionRich: source.descriptionRich,
      theme: source.theme,
      plusOnesAllowed: source.plusOnesAllowed,
      requirePlusOneNames: source.requirePlusOneNames,
      capacity: source.capacity,
      approvalRequired: source.approvalRequired,
      emailField: source.emailField,
      phoneField: source.phoneField,
      verifyEmail: source.verifyEmail,
      guestListVisibility: source.guestListVisibility,
      notifyOnRsvp: source.notifyOnRsvp,
      remindersEnabled: source.remindersEnabled,
      commentsEnabled: source.commentsEnabled,
      notifyOnComment: source.notifyOnComment,
      albumVisibility: source.albumVisibility,
      albumApprovalRequired: source.albumApprovalRequired,
      notifyOnPhoto: source.notifyOnPhoto,
      albumVideosAllowed: source.albumVideosAllowed,
      albumMaxVideoMinutes: source.albumMaxVideoMinutes,
      albumMaxVideoMb: source.albumMaxVideoMb,
      albumCopyQuality: source.albumCopyQuality,
      lettersEnabled: source.lettersEnabled,
      inviteOnly: source.inviteOnly,
      albumReminderDays: source.albumReminderDays,
      locale,
    },
    questions: questions.map(({ type, prompt, options, required }, position) => ({ type, prompt, options, required, position })),
  };
}
