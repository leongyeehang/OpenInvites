"use server";

import { getLocale, getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { requireHost } from "@/auth/session";
import { hostNeedsVerification } from "@/auth/verification";
import { can } from "@/hosts/role";
import type { FormState } from "@/lib/form-state";
import { queueGuestMail } from "@/mail/queue-guest-mail";
import { kickMailWorker } from "@/mail/worker";
import { parseOptions, pollState, whenOf, type OptionInput } from "@/polls/poll";
import { countVoters, dropUnvotedPoll, findOption, openPoll, pickDate } from "@/polls/repository";
import { parseQuestions } from "@/questions/question";
import { saveQuestions } from "@/questions/repository";
import { EMPTY_RICH_TEXT, parseRichText, richTextToPlain } from "@/rich-text/rich-text";
import { DEFAULT_GUEST_LIST_VISIBILITY } from "@/rsvps/visibility";
import { parseEventSettings, parseWhen, type WhenFields } from "./form";
import { eventsOwnedAtLimit } from "./limit";
import { missingToPublish } from "./publish";
import { createEvent, findHostEvent, publishEvent, updateEvent, type Event, type EventChanges } from "./repository";
import { eventPaths, eventUrl } from "./slug";
import { formatWhen, isTimeZone } from "./time";

// The editor's actions (M4 spec, "The editor"): a new event starts as a blank draft, and each piece
// of it is saved on its own as the host makes it, through the rules the 0.4 form followed
// (events/form.ts). Each answers whether it saved, and why not, which the editor says beside what
// was being saved.

// A refusal can name the control it is about, so the editor says it beside that control.
export type SaveResult = { saved: true } | { saved: false; error: string; field?: "capacity" | "questions" };

// A new event: a draft with no title and no date, the settings 0.4's form started with, and the
// look every event starts with (themes/theme.ts), dated later in the editor, which it opens in.
// The zone is the host's device's, which the browser posts, until the date sheet says otherwise.
// The operator's limit on events per host applies here, as the form's did.
export async function newEventAction(_: FormState, formData: FormData): Promise<FormState> {
  const host = await requireHost();
  const t = await getTranslations("Events");
  if (hostNeedsVerification(host)) return { error: t("verify.text", { email: host.email }) };
  const owned = await eventsOwnedAtLimit(host.id);
  if (owned !== undefined) return { error: t("errors.limitReached", { count: owned }) };
  const zone = formData.get("timeZone");
  const created = await createEvent(host.id, {
    title: "",
    startsAt: null,
    endsAt: null,
    allDay: false,
    timeZone: typeof zone === "string" && isTimeZone(zone) ? zone : "UTC",
    location: "",
    description: "",
    descriptionRich: EMPTY_RICH_TEXT,
    plusOnesAllowed: 1,
    requirePlusOneNames: false,
    capacity: null,
    approvalRequired: false,
    emailField: "none",
    phoneField: "none",
    verifyEmail: false,
    guestListVisibility: DEFAULT_GUEST_LIST_VISIBILITY,
    notifyOnRsvp: true,
    remindersEnabled: true,
    commentsEnabled: true,
    notifyOnComment: true,
    locale: await getLocale(),
  });
  redirect(`/events/${created.id}`);
}

// The event a host may edit, or nothing, answered as an event that is not theirs would be.
async function editable(id: string) {
  const host = await requireHost();
  const event = await findHostEvent(host.id, id);
  return event && can(event.role, "edit") ? { host, event } : undefined;
}

// Saves one piece, refreshing every page that shows the event, and kicks the mail worker when a
// change queued mail (a capacity raised, approval turned off).
async function save(hostId: string, event: Event, changes: Partial<EventChanges>): Promise<SaveResult> {
  const saved = await updateEvent(hostId, event.id, { ...changes, locale: await getLocale() });
  if (!saved) return { saved: false, error: (await getTranslations("Events"))("errors.notFound") };
  if (saved.mailed) after(kickMailWorker);
  for (const path of eventPaths(saved.updated)) revalidatePath(path);
  revalidatePath(`/events/${event.id}`);
  return { saved: true };
}

// The title, typed on the invitation. A draft's may be empty for now; a published event keeps one.
export async function saveTitleAction(id: string, title: string): Promise<SaveResult> {
  const found = await editable(id);
  const t = await getTranslations("Events");
  if (!found) return { saved: false, error: t("errors.notFound") };
  const trimmed = title.trim();
  if (!trimmed && found.event.state !== "draft") return { saved: false, error: t("errors.titleRequired") };
  return save(found.host.id, found.event, { title: trimmed });
}

// When it happens, from the date sheet.
export async function saveWhenAction(id: string, fields: WhenFields): Promise<SaveResult> {
  const found = await editable(id);
  const t = await getTranslations("Events");
  if (!found) return { saved: false, error: t("errors.notFound") };
  const when = parseWhen(fields);
  if (!when.ok) return { saved: false, error: t(`errors.${when.error}`) };
  // A date set by hand replaces a poll nobody has voted on; one with votes is decided by picking.
  if (pollState(found.event) === "open") {
    if ((await countVoters(found.event.id)) > 0) return { saved: false, error: t("errors.pollHasVotes") };
    await dropUnvotedPoll(found.event.id);
  }
  return save(found.host.id, found.event, when.when);
}

// "Not sure yet? Let guests vote" (M4 ticket 09): the date becomes a poll of two to six
// candidates. A draft, or a published event already polling, may; candidates change only while
// nobody has voted.
export async function savePollAction(id: string, posted: OptionInput[]): Promise<SaveResult> {
  const found = await editable(id);
  const t = await getTranslations("Events");
  if (!found) return { saved: false, error: t("errors.notFound") };
  const { event } = found;
  if (event.state === "cancelled" || pollState(event) === "closed" || (event.state === "published" && pollState(event) !== "open")) {
    return { saved: false, error: t("errors.pollNotNow") };
  }
  const options = parseOptions(posted);
  if (!options.ok) return { saved: false, error: t(`errors.${options.error}`) };
  if ((await openPoll(event.id, options.options)) === "hasVotes") return { saved: false, error: t("errors.pollHasVotes") };
  for (const path of eventPaths(event)) revalidatePath(path);
  revalidatePath(`/events/${event.id}`);
  return { saved: true };
}

// "Pick this date": the candidate becomes the event's date, the poll closes for good, and every
// voter who gave an email is told, in the language they voted in, with the link to reply.
export async function pickDateAction(id: string, optionId: string): Promise<SaveResult> {
  const found = await editable(id);
  const t = await getTranslations("Events");
  if (!found) return { saved: false, error: t("errors.notFound") };
  const { event } = found;
  const option = await findOption(event.id, optionId);
  if (!option || pollState(event) !== "open") return { saved: false, error: t("errors.pollNotNow") };
  const when = parseWhen(whenOf(option, event.timeZone));
  if (!when.ok) return { saved: false, error: t(`errors.${when.error}`) };
  const voters = await pickDate(event.id, when.when);
  if (!voters) return { saved: false, error: t("errors.pollNotNow") };
  const time = { ...when.when, timeZone: event.timeZone };
  const url = eventUrl(event);
  await queueGuestMail(
    event,
    voters,
    (voter, mail) => ({
      subject: mail("Mail.dateSet.subject", { title: event.title }),
      body: mail("Mail.dateSet.body", { name: voter.name, title: event.title, when: formatWhen(time, voter.locale), url }),
    }),
    "the date picked for",
  );
  for (const path of eventPaths(event)) revalidatePath(path);
  revalidatePath(`/events/${event.id}`);
  return { saved: true };
}

// Where, from its sheet: a place, an address or a link, or nothing.
export async function saveLocationAction(id: string, location: string): Promise<SaveResult> {
  const found = await editable(id);
  if (!found) return { saved: false, error: (await getTranslations("Events"))("errors.notFound") };
  return save(found.host.id, found.event, { location: location.trim() });
}

// The description, from its sheet's rich-text editor, which posts its document as JSON.
export async function saveDescriptionAction(id: string, posted: string): Promise<SaveResult> {
  const found = await editable(id);
  const t = await getTranslations("Events");
  if (!found) return { saved: false, error: t("errors.notFound") };
  let raw: unknown = { blocks: [] };
  if (posted) {
    try {
      raw = JSON.parse(posted);
    } catch {
      return { saved: false, error: t("errors.descriptionUnreadable") };
    }
  }
  const description = parseRichText(raw);
  if (!description.ok) return { saved: false, error: t(`errors.${description.error}`) };
  return save(found.host.id, found.event, { description: richTextToPlain(description.doc), descriptionRich: description.doc });
}

// Everything a guest does not see, from the Settings sheet, which posts all of it at each change.
export async function saveSettingsAction(id: string, formData: FormData): Promise<SaveResult> {
  const found = await editable(id);
  const t = await getTranslations("Events");
  if (!found) return { saved: false, error: t("errors.notFound") };
  const text = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : "";
  };
  const settings = parseEventSettings({
    plusOnesAllowed: text("plusOnesAllowed"),
    requirePlusOneNames: formData.get("requirePlusOneNames") === "on",
    capacity: text("capacity"),
    approvalRequired: formData.get("approvalRequired") === "on",
    emailField: text("emailField"),
    phoneField: text("phoneField"),
    verifyEmail: formData.get("verifyEmail") === "on",
    guestListVisibility: text("guestListVisibility"),
    notifyOnRsvp: formData.get("notifyOnRsvp") === "on",
    remindersEnabled: formData.get("remindersEnabled") === "on",
    commentsEnabled: formData.get("commentsEnabled") === "on",
    notifyOnComment: formData.get("notifyOnComment") === "on",
  });
  if (!settings.ok) return { saved: false, error: t(`errors.${settings.error}`), field: settings.error === "capacityInvalid" ? "capacity" : undefined };
  let posted: unknown = [];
  const raw = text("questions");
  if (raw) {
    try {
      posted = JSON.parse(raw);
    } catch {
      posted = null;
    }
  }
  const questions = parseQuestions(posted);
  if (!questions.ok) return { saved: false, error: t(`errors.${questions.error}`), field: "questions" };
  const saved = await save(found.host.id, found.event, settings.settings);
  if (saved.saved) await saveQuestions(found.event.id, questions.questions);
  return saved;
}

// Publishing needs a title and a date (M4 spec, "The editor"): which is missing is said, and the
// editor puts the focus on it. A published event opens its share page, with its link to send.
export type PublishResult = { missing: "title" | "date"; error: string } | undefined;

export async function publishAction(id: string): Promise<PublishResult> {
  const host = await requireHost();
  const event = await findHostEvent(host.id, id);
  if (!event || !can(event.role, "publish")) redirect("/dashboard");
  const t = await getTranslations("Editor");
  const missing = missingToPublish(event);
  if (missing) return { missing, error: t(missing === "title" ? "publishing.needsTitle" : "publishing.needsDate") };
  await publishEvent(host.id, id);
  for (const path of eventPaths(event)) revalidatePath(path);
  redirect(`/events/${id}/share`);
}
