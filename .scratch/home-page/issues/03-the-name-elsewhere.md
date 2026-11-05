# 03: The instance name in the tab, the header and the emails

**What to build:** Wherever the app says "OpenInvites" as the name of this site, it says the instance name the operator set, falling back to "OpenInvites".

**Blocked by:** 01 The Home page card in Instance settings

**Status:** ready-for-agent

- [ ] The root layout's `generateMetadata` (`src/app/layout.tsx`): title `instanceDisplayName(await homePage())`, description the welcome line or `Home.defaultWelcome` (the key ticket 02 adds; if ticket 02 has not landed, add it here with its text from ticket 02).
- [ ] `HostHeader` (`src/app/(host)/host-header.tsx`) shows `instanceDisplayName` where it shows `Home.title` today.
- [ ] Account emails: in `messages/en.json`, `zh-Hans.json` and `zh-Hant.json`, every "OpenInvites" in `Mail.verifyEmail`, `Mail.resetPassword`, `Mail.hostInvitation` and `Mail.magicLink` (subjects and bodies) becomes an `{instance}` placeholder, e.g. "Verify your email for {instance}", "Reset your {instance} password". Their senders (`src/auth/emails.ts`, `src/instance/emails.ts`) pass `instance: instanceDisplayName(await homePage())`.
- [ ] `Home.title` is removed once nothing reads it. Stays as it is: `PRODID` in `src/calendar/ics.ts`, `rpName` in `src/auth/auth.ts`, the legal placeholders, "Powered by OpenInvites", and the fresh state's "Your OpenInvites is ready".
- [ ] Browser tests in `e2e/home-page.spec.ts`:
  - with the name "Lim & <Family>" saved, the host header and the tab title show it literally, and a password reset asked for by the operator arrives in Mailpit as "Reset your Lim & <Family> password", with the name in its body;
  - after the name is cleared, the next reset email says "Reset your OpenInvites password" and the header says "OpenInvites".
- [ ] Specs on the shared `app` that check these subjects keep passing unchanged, since `app` has no name set.

## Notes for the implementer

- The mail helpers in `e2e/` (look for how `magic-link.spec.ts` or `host-accounts.spec.ts` read Mailpit) show how to find a message by recipient and read its subject.
- Plain-text email: the name goes in as typed. Do not HTML-escape it into the text.
- Commit subject, e.g. `Instance: the tab, the header and account emails use the instance's name`.

## Comments
