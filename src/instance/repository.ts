import { and, desc, eq, gt, isNull, or, sql } from "drizzle-orm";
import { cache } from "react";
import { getDb } from "@/db/client";
import { hostInvitation, instanceSettings, user } from "@/db/schema";
import { hostInvitationExpiry } from "./host-invitation";
import { hashHostInvitationToken } from "./host-invitation-token";
import type { RegistrationMode } from "./registration";

// The instance settings row always exists: the migration that made the table put it there.

export async function registrationMode(): Promise<RegistrationMode> {
  const [settings] = await getDb().select({ mode: instanceSettings.registrationMode }).from(instanceSettings);
  return settings.mode;
}

export async function setRegistrationMode(mode: RegistrationMode): Promise<void> {
  await getDb().update(instanceSettings).set({ registrationMode: mode });
}

// Cached per request: the header and the page both ask.
export const isOperator = cache(async (hostId: string): Promise<boolean> => {
  const [settings] = await getDb().select({ operatorId: instanceSettings.operatorId }).from(instanceSettings);
  return settings.operatorId === hostId;
});

export async function hasAccounts(): Promise<boolean> {
  const [any] = await getDb().select({ id: user.id }).from(user).limit(1);
  return any !== undefined;
}

// A sign-up that finds the instance empty takes it, in one statement: the settings row is locked
// while it is written, so of two first sign-ups at once only one sees no claim and makes it. The
// claim is kept until that account exists (seatNewHost below). The same email may claim again,
// should its first try have failed before the account was made.
export async function claimEmptyInstance(email: string): Promise<boolean> {
  const claimed = await getDb()
    .update(instanceSettings)
    .set({ firstAccountEmail: email })
    .where(
      and(
        sql`not exists (select 1 from ${user})`,
        or(isNull(instanceSettings.firstAccountEmail), eq(instanceSettings.firstAccountEmail, email)),
      ),
    )
    .returning({ id: instanceSettings.id });
  return claimed.length > 0;
}

// Once a new host's account exists. The first account becomes the operator, unless the one
// OPERATOR_EMAIL names got there in the meantime; the one OPERATOR_EMAIL names always becomes the
// operator, in place of whoever was. Either way there is one operator: it is one column.
export async function seatNewHost(host: { id: string; email: string }, byOperatorEmail: boolean): Promise<void> {
  const db = getDb();
  await db
    .update(instanceSettings)
    .set({ operatorId: sql`coalesce(${instanceSettings.operatorId}, ${host.id}::uuid)`, firstAccountEmail: null })
    .where(eq(instanceSettings.firstAccountEmail, host.email));
  if (byOperatorEmail) await db.update(instanceSettings).set({ operatorId: host.id });
}

// At start: the account OPERATOR_EMAIL names, if it exists, is the operator from now on.
export async function promoteOperator(email: string): Promise<void> {
  const [host] = await getDb().select({ id: user.id }).from(user).where(eq(user.email, email));
  if (host) await getDb().update(instanceSettings).set({ operatorId: host.id });
}

export type HostInvitation = typeof hostInvitation.$inferSelect;

export async function createHostInvitation(tokenHash: string, email: string | null, now: Date): Promise<void> {
  await getDb().insert(hostInvitation).values({ tokenHash, email, createdAt: now, expiresAt: hostInvitationExpiry(now) });
}

export async function listHostInvitations(): Promise<HostInvitation[]> {
  return getDb().select().from(hostInvitation).orderBy(desc(hostInvitation.createdAt));
}

export async function findHostInvitation(token: string): Promise<HostInvitation | undefined> {
  const [found] = await getDb()
    .select()
    .from(hostInvitation)
    .where(eq(hostInvitation.tokenHash, hashHostInvitationToken(token)));
  return found;
}

// Uses up a pending host invitation for this sign-up, or finds it unusable, in one statement: of
// two sign-ups racing on one link, the second finds it already used. The conditions are
// hostInvitationState's "pending".
export async function redeemHostInvitation(token: string, email: string, now: Date): Promise<boolean> {
  const used = await getDb()
    .update(hostInvitation)
    .set({ usedAt: now, usedByEmail: email })
    .where(
      and(
        eq(hostInvitation.tokenHash, hashHostInvitationToken(token)),
        isNull(hostInvitation.usedAt),
        isNull(hostInvitation.revokedAt),
        gt(hostInvitation.expiresAt, now),
      ),
    )
    .returning({ id: hostInvitation.id });
  return used.length > 0;
}

// Only an invitation nobody has used can be revoked; one used a moment earlier stays used.
export async function revokeHostInvitation(id: string, now: Date): Promise<void> {
  await getDb()
    .update(hostInvitation)
    .set({ revokedAt: now })
    .where(and(eq(hostInvitation.id, id), isNull(hostInvitation.usedAt), isNull(hostInvitation.revokedAt)));
}
