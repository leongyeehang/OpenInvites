import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { isOperator } from "@/instance/repository";
import { getAuth } from "./auth";

// One session lookup per request, however many components ask.
export const getSession = cache(async () => getAuth().api.getSession({ headers: await headers() }));

export type Host = NonNullable<Awaited<ReturnType<typeof getSession>>>["user"];

// Every host page and every host action calls this. A layout alone is not a guard:
// layouts do not re-render on client navigation (Next.js authentication guide).
export async function requireHost(): Promise<Host> {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return session.user;
}

// The instance settings page and its actions call this. Anyone but the operator, signed in or
// not, gets the not-found page any unknown address gets: the page does not exist for them.
export async function requireOperator(): Promise<Host> {
  const session = await getSession();
  if (!session || !(await isOperator(session.user.id))) notFound();
  return session.user;
}
