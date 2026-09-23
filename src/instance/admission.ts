import { operatorEmail } from "./env";
import { type InvitationOutcome, isOperatorEmail, signUpRefusal, type SignUpRefusal } from "./registration";
import { claimEmptyInstance, redeemHostInvitation, registrationMode, seatNewHost } from "./repository";

// Whether a new host may be created, asked just before Better Auth creates one (auth/auth.ts),
// whichever way they signed up. What can race is settled in the database, one statement each:
// taking an empty instance, and using up a host invitation. signUpRefusal decides from what
// they found. A host invitation the sign-up arrived with is used up whenever it still can be,
// even if the sign-up would have been let in anyway: the operator's list then says who used it.
export async function admitNewHost(email: string, invitationToken: string | null): Promise<SignUpRefusal | null> {
  const firstAccount = await claimEmptyInstance(email);
  let invitation: InvitationOutcome = "none";
  if (invitationToken) invitation = (await redeemHostInvitation(invitationToken, email, new Date())) ? "accepted" : "unusable";
  return signUpRefusal({
    byOperatorEmail: isOperatorEmail(email, operatorEmail()),
    firstAccount,
    mode: await registrationMode(),
    invitation,
  });
}

// Just after, once the account exists: the first account, or the one OPERATOR_EMAIL names,
// becomes the operator.
export async function seatAdmittedHost(host: { id: string; email: string }): Promise<void> {
  await seatNewHost(host, isOperatorEmail(host.email, operatorEmail()));
}
