import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { passkey } from "@/db/schema";

// A host's passkey as the account page lists it.
export type HostPasskey = { id: string; name: string | null; createdAt: Date | null; lastUsedAt: Date | null };

// A host's passkeys, oldest first.
export async function listPasskeys(userId: string): Promise<HostPasskey[]> {
  return getDb()
    .select({ id: passkey.id, name: passkey.name, createdAt: passkey.createdAt, lastUsedAt: passkey.lastUsedAt })
    .from(passkey)
    .where(eq(passkey.userId, userId))
    .orderBy(asc(passkey.createdAt), asc(passkey.id));
}

// Scoped to the host, so one host can never reach another's passkey.
export async function renamePasskey(userId: string, id: string, name: string): Promise<void> {
  await getDb()
    .update(passkey)
    .set({ name })
    .where(and(eq(passkey.id, id), eq(passkey.userId, userId)));
}

// Removing the last is allowed: the email and password stay.
export async function removePasskey(userId: string, id: string): Promise<void> {
  await getDb()
    .delete(passkey)
    .where(and(eq(passkey.id, id), eq(passkey.userId, userId)));
}
