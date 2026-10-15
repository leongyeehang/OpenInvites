import type { Locale } from "@/locale/resolve-locale";
import type { Question, QuestionInput } from "@/questions/question";
import type { Theme } from "@/themes/theme";
import type { EventChanges, Event } from "./repository";

// What a duplicate starts from: the details, look, settings and questions of the event it copies,
// and nothing that belongs to that event alone: its state (the copy is a draft), link, replies,
// answers, comments, announcements, co-hosts, views, reminder marks and publication date. The
// theme leaves the source's picture out, as the copy has a picture of its own to point at
// (uploads/copy.ts). The title says it is a copy, in the words of the host who duplicates it.
export function duplicateInput(
  source: Event,
  questions: Question[],
  locale: Locale,
  copySuffix: string,
): { event: EventChanges & { theme: Theme }; questions: QuestionInput[] } {
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
      theme: { ...source.theme, uploadId: null },
      plusOnesAllowed: source.plusOnesAllowed,
      requirePlusOneNames: source.requirePlusOneNames,
      askEmail: source.askEmail,
      guestListVisibility: source.guestListVisibility,
      notifyOnRsvp: source.notifyOnRsvp,
      remindersEnabled: source.remindersEnabled,
      commentsEnabled: source.commentsEnabled,
      notifyOnComment: source.notifyOnComment,
      locale,
    },
    questions: questions.map(({ type, prompt, options, required }, position) => ({ type, prompt, options, required, position })),
  };
}
