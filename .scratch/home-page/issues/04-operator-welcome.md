# 04: The operator's welcome sheet

**What to build:** The first time an operator opens their dashboard, a sheet says the site is theirs and points to the three settings that matter first. It shows once per operator.

**Blocked by:** 01 The Home page card in Instance settings (it links to the card)

**Status:** done

- [x] Schema: `instance_settings.welcomed_operator_id uuid` referencing `user.id` `ON DELETE SET NULL`. Migration `0042_operator_welcome.sql`, hand-edited to end with `UPDATE instance_settings SET welcomed_operator_id = operator_id;`, so the operator of an upgraded instance is not greeted.
- [x] Repository: `operatorToWelcome(hostId: string): Promise<boolean>`, true when `hostId` is the operator and `welcomed_operator_id` is not `hostId`; `markOperatorWelcomed(hostId: string)`. Action `dismissOperatorWelcomeAction()` behind `requireOperator()`.
- [x] `src/app/(host)/dashboard/operator-welcome.tsx`, drawn by the dashboard page when `operatorToWelcome(host.id)`. A sheet from the foot of the screen below `md` and a centred dialog from `md`, built on Radix `Dialog` as `EditorSheet` (`src/editor/sheet.tsx`) is, but in the dashboard's light look. It opens with the page and puts the focus on its heading.
  - A gallery poster's `card` file as a decorative picture (`alt=""`), chosen with `pickPoster`.
  - Heading "This site is yours"; text "You're its operator, the one account that decides how it works. Three things to look at first:"
  - Three rows, each a link into `/instance`:
    - "Name and welcome line", showing the name or "Not set: the home page says “OpenInvites”", to `#home-page`;
    - "Who can sign up", showing "Invitation only" or "Open";
    - "Limits and retention", showing "{events} events per host · kept {days} days after they end" or "· kept for ever".
  - Buttons: **Name your instance** (primary: dismisses, then goes to `/instance#home-page`, where the Name field has the focus) and **Not now** (dismisses).
  - Escape and a tap outside count as Not now.
  - Keys under `Dashboard.operatorWelcome.*` in all three languages.
- [x] Following a row's link also dismisses the sheet, so it never comes back.
- [x] Every spec whose first account becomes the operator dismisses the sheet through one helper, `dismissOperatorWelcome(page)` in `e2e/hosts.ts`: `operator.setup.ts`, `registration.spec.ts`, `registration-without-mail.spec.ts`, `limits.spec.ts`, `retention.spec.ts`, `home-page.spec.ts`. Grep `e2e/` for others.
- [x] Browser tests:
  - in `registration.spec.ts`, the first account sees "This site is yours" on its dashboard, with "Not set" and "Invitation only"; **Name your instance** lands on Instance settings with the Name field focused; back on the dashboard, after a reload, no sheet;
  - the `OPERATOR_EMAIL` takeover scenario's new operator sees the sheet once, and **Not now** dismisses it for good;
  - a host who is not the operator never sees it;
  - keyboard: Tab stays inside the sheet, Escape dismisses it, and the focus lands on the page's heading.
- [x] An axe check of the open sheet at 390 px and at desktop width, in `accessibility.spec.ts` or the registration spec, whichever already runs axe on a fresh instance.

## Notes for the implementer

- The dashboard is `src/app/(host)/dashboard/page.tsx`.
- `instanceLimits()` has the events-per-host limit, and `retentionDays` is on the same row (`null` = kept for ever).
- Commit subject, e.g. `Dashboard: a new operator is welcomed once and shown where to start`.

## Comments

**2026-11-04, implementing agent.** Done. `pnpm lint`, `pnpm typecheck` and `pnpm test` (82 files, 856 tests) pass; against the Docker test profile rebuilt with this change (`CI=1`) `registration`, `registration-without-mail`, `limits`, `retention` and `home-page` (through the project dependencies, 53 scenarios), and `instance-settings`, `keyboard`, `reports` and the accessibility specs for the dashboard and instance settings pass.

How it landed: `instance_settings.welcomed_operator_id` (migration `0042_operator_welcome.sql`, ending in the hand-written `UPDATE`); `operatorToWelcome` and `markOperatorWelcomed` in `src/instance/repository.ts`; `dismissOperatorWelcomeAction` behind `requireOperator()`, which also revalidates `/dashboard`; `operator-welcome.tsx`, a Radix `Dialog` drawn by the dashboard page when `operatorToWelcome(host.id)`. Every way out (Not now, Escape, a tap outside, a row, Name your instance) calls the action first, so the sheet never returns; the rows and Name your instance dismiss and then `router.push`. The Home page card focuses its Name field when the page opens at `#home-page`. The Registration and Limits cards got the ids `registration` and `limits` for the other two rows.

Decisions and things to know:
- Dismissing hands the focus to the dashboard's `h1` (made `tabIndex={-1}`), since nothing opened the sheet to give it back to.
- A modal dialog hides the page behind it from the accessibility tree, so `signUp` in `e2e/hosts.ts` accepts the open sheet in place of the header, and the scenarios that need the header or the Instance settings link dismiss first. The first scenario of `registration.spec.ts` now goes to Instance settings through Name your instance.
- `operator.setup.ts` dismisses only when it has just made or verified the account, so a reused database (already marked welcomed by the migration) is not waited on.
- The keyboard scenario (Tab stays inside, Escape dismisses, focus on the heading) is in `registration-without-mail.spec.ts`'s restart takeover, the one place a new operator's sheet is still unopened; the axe checks (desktop and 390 px) are in `registration.spec.ts`, which runs on a fresh instance.
- The description uses a curly apostrophe (“You’re”), as the rest of the interface does.

Left for later tickets or noted: ticket 05 may want the Chinese reviewed.

Chinese least sure of: `Dashboard.operatorWelcome.title` "这个实例属于你" / "這個實例屬於你"; `notNow` "暂不设置" / "暫不設定"; `limits.kept` "每位主办人 N 个活动 · 活动结束后保留 N 天".
