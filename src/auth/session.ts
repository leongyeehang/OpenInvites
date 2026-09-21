import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
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
