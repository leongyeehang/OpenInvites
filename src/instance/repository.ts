import { and, desc, eq, gt, isNull, or, sql } from "drizzle-orm";
import { cache } from "react";
import { getDb } from "@/db/client";
import { hostInvitation, instanceSettings, user } from "@/db/schema";
import { hostInvitationExpiry } from "./host-invitation";
import { hashHostInvitationToken } from "./host-invitation-token";
import type { OperatorSeat, RegistrationMode } from "./registration";

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
// claim is kept until that account exists (seatFirstAccount below). The same email may claim again,
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

// Once a new host's account exists: if it took the empty instance, it becomes the operator,
// unless the account OPERATOR_EMAIL names was seated in the meantime. There is one operator
// whatever happens: it is one column.
export async function seatFirstAccount(host: { id: string; email: string }): Promise<void> {
  await getDb()
    .update(instanceSettings)
    .set({ operatorId: sql`coalesce(${instanceSettings.operatorId}, ${host.id}::uuid)`, firstAccountEmail: null })
    .where(eq(instanceSettings.firstAccountEmail, host.email));
}

// The account OPERATOR_EMAIL names takes the operator's seat as operatorEmailSeat allows: in place
// of whoever holds it, or only while nobody does, which the statement itself checks.
export async function takeOperatorSeat(hostId: string, seat: OperatorSeat): Promise<void> {
  if (seat === "none") return;
  await getDb()
    .update(instanceSettings)
    .set({ operatorId: hostId })
    .where(seat === "takeIfEmpty" ? isNull(instanceSettings.operatorId) : undefined);
}

export async function findAccountByEmail(email: string): Promise<{ id: string; emailVerified: boolean } | undefined> {
  const [found] = await getDb().select({ id: user.id, emailVerified: user.emailVerified }).from(user).where(eq(user.email, email));
  return found;
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
