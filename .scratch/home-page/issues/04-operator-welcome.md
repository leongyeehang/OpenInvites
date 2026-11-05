# 04: The operator's welcome sheet

**What to build:** The first time an operator opens their dashboard, a sheet says the site is theirs and points to the three settings that matter first. It shows once per operator.

**Blocked by:** 01 The Home page card in Instance settings (it links to the card)

**Status:** ready-for-agent

- [ ] Schema: `instance_settings.welcomed_operator_id uuid` referencing `user.id` `ON DELETE SET NULL`. Migration `0042_operator_welcome.sql`, hand-edited to end with `UPDATE instance_settings SET welcomed_operator_id = operator_id;`, so the operator of an upgraded instance is not greeted.
- [ ] Repository: `operatorToWelcome(hostId: string): Promise<boolean>`, true when `hostId` is the operator and `welcomed_operator_id` is not `hostId`; `markOperatorWelcomed(hostId: string)`. Action `dismissOperatorWelcomeAction()` behind `requireOperator()`.
- [ ] `src/app/(host)/dashboard/operator-welcome.tsx`, drawn by the dashboard page when `operatorToWelcome(host.id)`. A sheet from the foot of the screen below `md` and a centred dialog from `md`, built on Radix `Dialog` as `EditorSheet` (`src/editor/sheet.tsx`) is, but in the dashboard's light look. It opens with the page and puts the focus on its heading.
  - A gallery poster's `card` file as a decorative picture (`alt=""`), chosen with `pickPoster`.
  - Heading "This site is yours"; text "You're its operator, the one account that decides how it works. Three things to look at first:"
  - Three rows, each a link into `/instance`:
    - "Name and welcome line", showing the name or "Not set: the home page says “OpenInvites”", to `#home-page`;
    - "Who can sign up", showing "Invitation only" or "Open";
    - "Limits and retention", showing "{events} events per host · kept {days} days after they end" or "· kept for ever".
  - Buttons: **Name your instance** (primary: dismisses, then goes to `/instance#home-page`, where the Name field has the focus) and **Not now** (dismisses).
  - Escape and a tap outside count as Not now.
  - Keys under `Dashboard.operatorWelcome.*` in all three languages.
- [ ] Following a row's link also dismisses the sheet, so it never comes back.
- [ ] Every spec whose first account becomes the operator dismisses the sheet through one helper, `dismissOperatorWelcome(page)` in `e2e/hosts.ts`: `operator.setup.ts`, `registration.spec.ts`, `registration-without-mail.spec.ts`, `limits.spec.ts`, `retention.spec.ts`, `home-page.spec.ts`. Grep `e2e/` for others.
- [ ] Browser tests:
  - in `registration.spec.ts`, the first account sees "This site is yours" on its dashboard, with "Not set" and "Invitation only"; **Name your instance** lands on Instance settings with the Name field focused; back on the dashboard, after a reload, no sheet;
  - the `OPERATOR_EMAIL` takeover scenario's new operator sees the sheet once, and **Not now** dismisses it for good;
  - a host who is not the operator never sees it;
  - keyboard: Tab stays inside the sheet, Escape dismisses it, and the focus lands on the page's heading.
- [ ] An axe check of the open sheet at 390 px and at desktop width, in `accessibility.spec.ts` or the registration spec, whichever already runs axe on a fresh instance.

## Notes for the implementer

- The dashboard is `src/app/(host)/dashboard/page.tsx`.
- `instanceLimits()` has the events-per-host limit, and `retentionDays` is on the same row (`null` = kept for ever).
- Commit subject, e.g. `Dashboard: a new operator is welcomed once and shown where to start`.

## Comments
