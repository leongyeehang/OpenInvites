// Resets a host's password from inside the container, for instances without mail:
//
//   docker compose exec app node scripts/reset-password.mjs host@example.org
//
// Prints a temporary password for the operator to pass on. The host signs in with it
// and changes it in account settings. Plain JavaScript with one dependency (postgres),
// so it runs in the production image, which carries no TypeScript toolchain.
import { randomBytes, randomInt, scryptSync } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

// Better Auth's default hasher: scrypt with these parameters, stored as `saltHex:keyHex`.
// scripts/reset-password.test.ts pins this against Better Auth's own verifyPassword.
const SCRYPT = { N: 16384, r: 16, p: 1, dkLen: 64 };

/** @param {string} password */
export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const key = scryptSync(password.normalize("NFKC"), salt, SCRYPT.dkLen, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
    maxmem: 128 * SCRYPT.N * SCRYPT.r * 2,
  });
  return `${salt}:${key.toString("hex")}`;
}

// Lowercase letters and digits without l, o, 0, 1: safe to read aloud or type from a chat message.
const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

export function generateTemporaryPassword() {
  let password = "";
  for (let i = 0; i < 16; i++) password += ALPHABET[randomInt(ALPHABET.length)];
  return password;
}

/** @param {string} message */
function fail(message) {
  console.error(message);
  process.exit(1);
}

/** @param {string | undefined} email */
async function main(email) {
  const url = process.env.DATABASE_URL;
  if (!url) return fail("DATABASE_URL is not set");
  if (!email) return fail("Usage: node scripts/reset-password.mjs <host email>");

  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    const [host] = await sql`select id, name from "user" where email = ${email.trim().toLowerCase()}`;
    if (!host) return fail(`No host has the email ${email}`);

    const password = generateTemporaryPassword();
    const hash = hashPassword(password);
    // Better Auth keeps the password on the "credential" account row, keyed by the user's id.
    const updated = await sql`
      update account set password = ${hash}, updated_at = now()
      where user_id = ${host.id} and provider_id = 'credential'`;
    if (updated.count === 0) return fail(`${email} has no password to reset`);

    console.log(`Temporary password for ${host.name} <${email}>: ${password}`);
    console.log("Ask them to sign in with it and change it in account settings.");
  } finally {
    await sql.end();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv[2]).catch((error) => fail(error instanceof Error ? error.message : String(error)));
}
