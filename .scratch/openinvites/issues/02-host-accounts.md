# 02: Host accounts

**What to build:** A person becomes a host: signs up with email and password, verifies their email when the instance has mail, signs in and out on several devices, sets a display name, manages their account, resets a forgotten password, and deletes their account. The operator can reset any host's password from inside the container.

**Blocked by:** 01 Walking skeleton

**Status:** done

- [x] Sign up and sign in with email and password through Better Auth; sessions stay valid on two devices at once; sign out works per device.
- [x] A display name is required at sign-up, editable in account settings, and shown in the host area's header.
- [x] When SMTP is configured, a verification email is sent through the Mail module; unverified hosts see a banner with a resend action and cannot create events (the gate is enforced once events exist in ticket 05). When SMTP is not configured, verification is skipped entirely.
- [x] Password reset by email when SMTP is configured; without SMTP the reset screen says to contact the operator and shows the operator contact address from the environment.
- [x] A command runnable inside the container resets a host's password by email address and prints a temporary password or one-time link.
- [x] Account settings allow changing display name, email (re-verified when SMTP is configured), and password.
- [x] Delete account asks for confirmation and removes the account and its sessions; the cascade to events and RSVPs is verified in ticket 16.
- [x] Browser tests cover sign up, verify through the fake mail server, sign in, change display name, reset password, and delete account, at phone and desktop widths.
- [x] All strings are in the English translation file.

## Comments

**2026-09-21, implementing agent.** Done. Lint, type check, 17 unit tests, and 26 browser tests (13 scenarios at 390px and desktop) pass locally against the production image on the Compose `test` profile, which now configures SMTP through Mailpit.

How it landed:

- Better Auth owns the `user`, `session`, `account`, and `verification` tables (migration `0001_host_accounts`), with Postgres generating UUIDv7 ids (ADR-0004) and telemetry off (ADR-0005). Hosts are Better Auth users, so those table names stay; the interface and code about the domain say host, operator, instance.
- Forms are server actions over `auth.api`; Better Auth's own HTTP endpoints are mounted under `/api/auth` for the links in emails. The host area (`/dashboard`, `/account`) checks the session in every page, not only in the layout.
- Mail is one module (`src/mail`): `SMTP_URL` plus `MAIL_FROM`, plain-text emails in the host's language. Unset `SMTP_URL` means no verification banner, no reset by email, and the reset screen shows `OPERATOR_CONTACT_EMAIL`. Without mail, changing the email is immediate even for a host who verified earlier (Better Auth alone would refuse that).
- The operator command is `node scripts/reset-password.mjs <email>` inside the container; it prints a temporary password. It is covered by a browser test that runs it through `docker compose exec`, and a unit test pins its hash format against Better Auth's `verifyPassword`. Getting `postgres` importable from the image needed `serverExternalPackages` plus a symlink in the Dockerfile.
- `.env.development` now has mail on by default: the `dev` Compose profile runs Mailpit (UI on 8025). Mailpit's reverse DNS lookup is disabled because it cost 8 seconds per email behind Docker's port proxy.

Left for later tickets or noted:

- Chinese strings for the new screens are ticket 20; those pages show English keys in the other two locales until then (README says so).
- Better Auth logs, but does not surface, a failed send: with SMTP configured but unreachable, sign-up succeeds silently and "Resend" reports success. Operational; visible in the container logs.
- The home page gained Sign in and Create an account links so the flows are reachable.
