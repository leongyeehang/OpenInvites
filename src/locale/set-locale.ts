"use server";

import { cookies } from "next/headers";
import { isLocale, LOCALE_COOKIE } from "./resolve-locale";

const oneYear = 60 * 60 * 24 * 365;

export async function setLocale(formData: FormData): Promise<void> {
  const locale = formData.get("locale");
  if (!isLocale(locale)) return;
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, { path: "/", maxAge: oneYear, sameSite: "lax" });
}
