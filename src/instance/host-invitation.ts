// A host invitation lets one person become a host while registration is invitation only
// (CONTEXT.md). It is a single-use link that works for fourteen days.

export const HOST_INVITATION_DAYS = 14;

const DAY = 24 * 60 * 60 * 1000;

export type HostInvitationState = "pending" | "used" | "revoked" | "expired";

export function hostInvitationExpiry(createdAt: Date): Date {
  return new Date(createdAt.getTime() + HOST_INVITATION_DAYS * DAY);
}

// Used and revoked are for good, so they win over the clock: the operator's list says what
// happened to an invitation rather than only that it no longer works. A pending one past its
// fourteen days is expired, so a dead link never reads as live. The query that uses one up
// (instance/repository.ts) asks the same three questions in one statement.
export function hostInvitationState(
  invitation: { usedAt: Date | null; revokedAt: Date | null; expiresAt: Date },
  now: Date,
): HostInvitationState {
  if (invitation.usedAt) return "used";
  if (invitation.revokedAt) return "revoked";
  return now < invitation.expiresAt ? "pending" : "expired";
}

// Whole days until a pending invitation runs out, a part of a day counting as one. Counted rather
// than shown as a date, which would need the operator's time zone.
export function hostInvitationDaysLeft(expiresAt: Date, now: Date): number {
  return Math.ceil((expiresAt.getTime() - now.getTime()) / DAY);
}
