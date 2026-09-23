import { isMailConfigured } from "@/mail/config";
import { operatorEmail } from "./env";
import { type InvitationOutcome, isOperatorEmail, operatorEmailSeat, signUpRefusal, type SignUpRefusal } from "./registration";
import {
  claimEmptyInstance,
  findAccountByEmail,
  redeemHostInvitation,
  registrationMode,
  seatFirstAccount,
  takeOperatorSeat,
} from "./repository";

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

type Account = { id: string; email: string; emailVerified: boolean };

// The account OPERATOR_EMAIL names, when it is created or verifies its email, or at start, takes
// the operator's seat as far as operatorEmailSeat allows. Any other account is left as it is.
async function seatOperatorEmail(account: Account, moment: "account" | "start"): Promise<void> {
  if (!isOperatorEmail(account.email, operatorEmail())) return;
  await takeOperatorSeat(account.id, operatorEmailSeat(moment, account, isMailConfigured()));
}

// Just after a new host is created: the first account becomes the operator, and so, perhaps, does
// the one OPERATOR_EMAIL names.
export async function seatAdmittedHost(account: Account): Promise<void> {
  await seatFirstAccount(account);
  await seatOperatorEmail(account, "account");
}

// When a host opens a verification link, and the address it verified is the one OPERATOR_EMAIL names.
export async function seatVerifiedHost(account: Account): Promise<void> {
  await seatOperatorEmail(account, "account");
}

// At every start, if the account OPERATOR_EMAIL names exists.
export async function promoteOperatorAtStart(): Promise<void> {
  const email = operatorEmail();
  const account = email ? await findAccountByEmail(email) : undefined;
  if (email && account) await seatOperatorEmail({ ...account, email }, "start");
}
