import { APIError } from "better-auth/api";
import { getTranslations } from "next-intl/server";
import type en from "../../messages/en.json";

type ErrorCode = keyof typeof en.Auth.errors;

// Turns a Better Auth failure into a sentence in the host's language. Codes without a
// translation are unexpected: they are logged and shown as a generic message.
export async function authErrorMessage(error: unknown): Promise<string> {
  const t = await getTranslations("Auth.errors");
  const code = error instanceof APIError ? (error.body?.code as ErrorCode | undefined) : undefined;
  if (code && t.has(code)) return t(code);
  console.error(error);
  return t("unknown");
}
