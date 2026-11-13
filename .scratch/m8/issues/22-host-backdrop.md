# 22: Account: a host picks the poster behind their own pages

**What to build:** A Backdrop card in Account where a host chooses Automatic or one gallery poster, from the gallery's own pictures drawn large. Their pick dresses their dashboard, Account and New event; each event's guests, invites, share, co-hosts and announcements pages keep that event's poster. Automatic is today's behaviour: the next event's poster, else one of the site's. The pick is kept in a small table of its own, apart from the auth library's `user` table, and goes with the account when it is deleted.

**Blocked by:** 20

**Status:** done

**Stories:** 299, 298

**Interfaces**
- Consumes: `hostLook`, `hostLookOf`, `HostFrame` (tickets 17 and 20); `GalleryPosterId`, `findGalleryPoster`, `GALLERY_POSTERS`, `OCCASIONS` (`src/themes/posters.ts`); `PosterChoices` (`src/app/instance/instance-forms.tsx:136-185`); `requireHost` (`src/auth/session.ts`); `FormState` (`src/lib/form-state.ts`), `FormOutcome` (`src/components/form-outcome.tsx`); `user` (`src/db/schema.ts:30`); `expectSiteLook`, `expectRingStandsOut` (ticket 18).
- Produces:
  - Table `host_look`: `host_id uuid primary key references "user"(id) on delete cascade`, `poster text` (null: Automatic), `updated_at timestamp with time zone not null default now()`. Drizzle `hostLook` table in `src/db/schema.ts` beside `user`'s other dependants.
  - `src/instance/site-look.ts`: `export function parseBackdropChoice(value: string): { ok: true; poster: GalleryPosterId | null } | { ok: false }` and `export function storedPick(value: string | null): GalleryPosterId | null`.
  - `src/hosts/look.ts`: `export const findHostLook = cache(async (hostId: string): Promise<GalleryPosterId | null> => …)` and `export async function setHostLook(hostId: string, poster: GalleryPosterId | null): Promise<void>` (an upsert on `host_id`).
  - `src/hosts/actions.ts`: `export async function setHostLookAction(_: FormState, formData: FormData): Promise<FormState>`.
  - `src/themes/poster-choices.tsx` (`"use client"`): `PosterChoices` moved out of `instance-forms.tsx`, with props `{ mode: "picked" | "one"; ids: GalleryPosterId[]; onToggle; onPick; name: string; idPrefix: string; size?: "small" | "large" }`; Site settings passes `name="posterIds" idPrefix="home"` and draws as today.
  - `src/app/(host)/(own)/account/backdrop-form.tsx`: `export function BackdropForm({ pick }: { pick: GalleryPosterId | null })`.
  - Messages `Account.backdrop.*`.

- [x] Unit tests in `src/instance/site-look.test.ts`, then the code: `parseBackdropChoice("auto")` is `{ ok: true, poster: null }`; `("disco")` is `{ ok: true, poster: "disco" }`; `("disco-ball")`, `("")` and `("AUTO")` are `{ ok: false }`. `storedPick(null)` is null, `storedPick("aurora")` is "aurora", `storedPick("retired-poster")` is null (a poster that has left the gallery reads as Automatic).
- [x] Migration: `pnpm db:generate --name host_look` at the next free number, with the repo's leading comment saying what the table is for and why it is not a column on `user`.
- [x] `src/hosts/look.ts` and `setHostLookAction`: `requireHost()`, `parseBackdropChoice(String(formData.get("poster") ?? ""))`, on a refusal `{ error: t("unknown") }`, else `setHostLook`, `revalidatePath("/", "layout")` so the frame is drawn again with the new look, and `{ success: t("saved") }`. `hostLook` (`src/dashboard/host-look.ts`) passes `pick: await findHostLook(hostId)` to `hostLookOf`.
- [x] Move `PosterChoices` to `src/themes/poster-choices.tsx`; `size="large"` draws two across below `sm` and four from `sm`, the card picture at 4:5 with the poster's name under it. `HomePageForm` uses it with today's look.
- [x] `BackdropForm`: a `fieldset` named by the card's title holding a radio "Automatic" (`value="auto"`, with its hint) and `PosterChoices` in mode `one`, `name="poster"`, `idPrefix="backdrop"`, `size="large"`, then `FormOutcome` and a Save button. In `src/app/(host)/(own)/account/page.tsx` a `<Card id="backdrop">` after Passkeys and before Delete, reading `findHostLook(host.id)`; the page's `ClientMessages` adds `"Account.backdrop"` and `"Posters"`.
- [x] Messages in `messages/en.json`, `zh-Hans.json` and `zh-Hant.json`, under `Account.backdrop`: `title` "Backdrop", `description` "The picture behind your dashboard, this page and New event. Each event’s own pages wear that event’s poster.", `automatic` "Automatic", `automaticHint` "Your next event’s poster, or one of this site’s.", `submit` "Save", `saved` "Backdrop saved.", `unknown` "Choose Automatic or one of the gallery’s posters."
- [x] Browser, in `e2e/site-look.spec.ts` (shared `app`, both projects), each watched failing first:
  - "a host's pick dresses their own pages and not an event's": a host with a published event on Disco chooses Aurora in Backdrop and saves; "Backdrop saved." shows and the page passes `expectSiteLook(page, "aurora-copy")` without a reload; `/dashboard` and `/events/new` wear `aurora-copy`; the event's `/guests` wears `disco-ball-copy`; after a reload Aurora is still chosen.
  - "Automatic brings back the next event's poster": choosing Automatic and saving puts `disco-ball-copy` back on `/account` and `/dashboard`.
  - "the Backdrop card by keyboard": Tab to Automatic, the arrow keys to Aurora, Tab to Save, Enter; "Backdrop saved." shows; `expectRingStandsOut` holds for Automatic, a poster and Save.
  - `e2e/accessibility.spec.ts`: axe on `/account` with the Backdrop card and a poster chosen, at 390 px and desktop. `e2e/locales.spec.ts`: in zh-Hant the card's title and Automatic read in Chinese.
- [x] Existing specs: `instance-settings.spec.ts` and `home-page.spec.ts` (`home-instance`) still pick posters on Site settings through the moved component; `host-accounts.spec.ts` (deleting an account still works, and with it the row), `accessibility.spec.ts`, `keyboard.spec.ts`, `locales.spec.ts`, `site-look.spec.ts`. `translations.test.ts` and `client-messages.test.ts` stay green.
- [x] Checks: `pnpm lint`, `pnpm typecheck`, `pnpm test`, then `docker compose --profile test up -d --build --wait` (a schema change) and the specs above (`CI=1`, `--workers=2`). Comments entry; commit `Account: a host picks the poster behind their own pages`.

## Notes for the implementer

- **(plan)** "Big live swatches" are the gallery's own card pictures, drawn larger than Site settings draws them, chosen and then saved with Save; the page's backdrop changes on saving, without a reload. Saving on every change would post once per arrow key as someone on a keyboard moves through twenty posters.
- **(plan)** A pick of a poster that has since left the gallery reads as Automatic (`storedPick`), as an event whose gallery poster is gone falls back (`resolveTheme`).
- The table is not a column on `user`: that table is the auth library's (Better Auth), and its shape is its own.
- `revalidatePath("/", "layout")` is what makes the `(own)` layout draw again in the same response; a layout is otherwise kept between pages.
- The pick is the host's alone: a co-host's dashboard wears their own pick or their own next event.
- `client-messages.test.ts` fails on a namespace passed but not read: `BackdropForm` reads both `Account.backdrop` and `Posters` (the names, through `PosterChoices`).

## Comments

### 2026-11-12: landed (Opus 5.5)

**How it landed.** As Produces says. `host_look` is migration 0063 (`drizzle/0063_host_look.sql`,
its leading comment saying why it is not a column on `user`), applied by rebuilding the test
profile on all three test databases. `parseBackdropChoice` and `storedPick` are in
`src/instance/site-look.ts`; `findHostLook` (cached) and `setHostLook` (an upsert on `host_id`) in
`src/hosts/look.ts`; `setHostLookAction` in `src/hosts/actions.ts` reads only the form's `poster`
and the host from `requireHost()`. `hostLook` reads the pick beside the events and the home page,
and with a pick no longer reads the glowing event's upload. `PosterChoices` is
`src/themes/poster-choices.tsx`; Site settings passes `name="posterIds" idPrefix="home"` and draws
as before. `BackdropForm` is one radio group, `poster`: Automatic (`value="auto"`, with its hint)
and the twenty posters; its `FieldSet` is named by an `sr-only` legend with the card's title, as
`RegistrationForm`'s is. The card sits between Passkeys and Delete as `<Card id="backdrop">`.

**Beyond the ticket's text.**
- **The chosen poster is ringed and ticked** at `size="large"`: the 2px accent ring Site settings
  draws, and a check mark in an accent circle (onAccent on the accent) at its top right, shown by
  CSS (`peer-checked:flex`), so it is right before the page's script runs. The large grid's gap is
  16px, so `expectRingStandsOut`'s 12px strip beside a poster never reaches its neighbour.
- **A poster's name is in a span of its own inside the block under the picture**, both sizes (no
  change on screen). The picture is 4:5 of a width that is seldom whole, so the name block's top
  row shares a pixel row with the picture's bottom; on Cake at 390px `worstContrast` read Aurora's
  dark sky there and gave 1.07. The inner span's box is the words' alone.
- `e2e/host-accounts.spec.ts` "a host changes their display name and sees it in the header"
  clicked the page's only "Save"; Account now has two, so it clicks the Display name card's.
- `accessibility.spec.ts`: the 180 s budget's comment says it is a stopgap, to be put back in
  ticket 23. `site-look.spec.ts`: "the invite-only notice reads under light text" (Disco).

**Tests.** `site-look.spec.ts`: "a host's pick dresses their own pages and not an event's" (also a
tampered value, "disco-ball", refused with `unknown` and nothing stored after a fresh load, and a
second host whose dashboard keeps the site's poster for hosts and whose card is on Automatic);
"Automatic brings back the next event's poster"; "the Backdrop card by keyboard, and its words",
once on Disco under light text and once on Cake under dark text: Automatic's label and hint and a
poster's name at 4.5 or more, the rings round Automatic, Aurora and Save, the tick on the chosen
one only, then Tab, the arrow keys to Aurora, Tab, Enter. `accessibility.spec.ts`: "the account
page with the Backdrop card, a poster chosen". `locales.spec.ts`: "a host reads the Backdrop card in
Traditional Chinese". `host-accounts.spec.ts`: a backdrop is saved before the account is deleted.
A pick reloaded is checked with a fresh `goto`, not `reload`, so the browser's form restoring does
not stand in for what was stored.

**Evidence.** RED: `site-look.test.ts`, 4 failed (`parseBackdropChoice`/`storedPick` not
functions). The four Backdrop rows against the test profile before the change, desktop: 4 failed
(no `#backdrop` card); the invite-only row passed (it checks what ticket 21 drew). GREEN: unit 14
passed; `pnpm test` 119 files, 1412 tests; `pnpm lint`, `pnpm typecheck` clean. On the rebuilt test
profile, `CI=1 --workers=2`, both widths: `site-look`, `host-accounts`, `locales`,
`instance-settings`, `keyboard`, `accessibility`: 225 passed, none flaky. `home-instance`
(`--no-deps`, `home-page.spec.ts` through the moved picker): 19 passed.
