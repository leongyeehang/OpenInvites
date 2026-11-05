# 03: The instance name in the tab, the header and the emails

**What to build:** Wherever the app says "OpenInvites" as the name of this site, it says the instance name the operator set, falling back to "OpenInvites".

**Blocked by:** 01 The Home page card in Instance settings

**Status:** done

- [x] The root layout's `generateMetadata` (`src/app/layout.tsx`): title `instanceDisplayName(await homePage())`, description the welcome line or `Home.defaultWelcome` (the key ticket 02 adds; if ticket 02 has not landed, add it here with its text from ticket 02).
- [x] `HostHeader` (`src/app/(host)/host-header.tsx`) shows `instanceDisplayName` where it shows `Home.title` today.
- [x] Account emails: in `messages/en.json`, `zh-Hans.json` and `zh-Hant.json`, every "OpenInvites" in `Mail.verifyEmail`, `Mail.resetPassword`, `Mail.hostInvitation` and `Mail.magicLink` (subjects and bodies) becomes an `{instance}` placeholder, e.g. "Verify your email for {instance}", "Reset your {instance} password". Their senders (`src/auth/emails.ts`, `src/instance/emails.ts`) pass `instance: instanceDisplayName(await homePage())`.
- [x] `Home.title` is removed once nothing reads it. Stays as it is: `PRODID` in `src/calendar/ics.ts`, `rpName` in `src/auth/auth.ts`, the legal placeholders, "Powered by OpenInvites", and the fresh state's "Your OpenInvites is ready".
- [x] Browser tests in `e2e/home-page.spec.ts`:
  - with the name "Lim & <Family>" saved, the host header and the tab title show it literally, and a password reset asked for by the operator arrives in Mailpit as "Reset your Lim & <Family> password", with the name in its body;
  - after the name is cleared, the next reset email says "Reset your OpenInvites password" and the header says "OpenInvites".
- [x] Specs on the shared `app` that check these subjects keep passing unchanged, since `app` has no name set.

## Notes for the implementer

- The mail helpers in `e2e/` (look for how `magic-link.spec.ts` or `host-accounts.spec.ts` read Mailpit) show how to find a message by recipient and read its subject.
- Plain-text email: the name goes in as typed. Do not HTML-escape it into the text.
- Commit subject, e.g. `Instance: the tab, the header and account emails use the instance's name`.

## Comments

**2026-11-04, implementing agent.** Done. `pnpm lint`, `pnpm typecheck` and `pnpm test` (82 files, 856 tests) pass; the browser specs pass against the Docker test profile rebuilt with this change (`CI=1`).

How it landed: the root layout's `generateMetadata` reads `homePage()` for the title and the welcome line (or `Home.defaultWelcome`); `HostHeader` shows `instanceDisplayName(await homePage())`; the four account mails (`src/auth/emails.ts`, `src/instance/emails.ts`) pass `instance` to subject and body; `Home.title` and `Home.tagline` are gone from the three message files.

Decisions and things to know:
- `Mail.resetPassword`'s body had no "OpenInvites" in it, but the ticket's test wants the name in the reset body, so the body now says "choose a new password for {instance}" (and the Chinese likewise). `e2e/hosts.ts` still finds it by "choose a new password".
- Every page (the not-found page too) defines its own title, so the root layout's title is a fallback no visitor reaches; the tab scenarios read the home page's tab, which ticket 02 already set from the name.
- Nothing escapes the name: next-intl puts arguments in as typed, and the test uses "Lim & <Family>".

Left for later tickets or noted: nothing.

Chinese least sure of: `Mail.resetPassword.body` "为你在 {instance} 的账号设置新密码" / "為你在 {instance} 的帳號設定新密碼".
