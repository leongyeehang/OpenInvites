"use server";

import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import type { FormState } from "@/lib/form-state";
import { blankEmailByMailToken } from "@/rsvps/repository";

// The stop page's button: stops mail to whoever the mail token names, and says so in the language
// of the page it was pressed on. An RSVP's or a voter's email is blanked; an invite's is kept and
// marked as stopped, and so is the reply made through it (rsvps/repository.ts,
// blankEmailByMailToken). The guest can give an email again by editing their RSVP.
export async function stopMailAction(token: string): Promise<FormState> {
  const stopped = await blankEmailByMailToken(token);
  if (!stopped) notFound();
  const t = await getTranslations("StopMail");
  return { success: t("done", { title: stopped.title }) };
}
