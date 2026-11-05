# 01: The Home page card in Instance settings

**What to build:** The operator sets the instance's name and welcome line, which posters the home page shows, and whether it says who runs the site. This ticket stores and edits the settings; ticket 02 makes the home page use them.

**Blocked by:** nothing

**Status:** done

- [x] Schema: `instance_settings` gains `instance_name text`, `welcome_line text` (both null = not set), `home_posters text not null default 'all'` with check `home_posters IN ('all', 'picked', 'one')`, `home_poster_ids text[] not null default '{}'`, `show_operator boolean not null default false`. Migration `0041_home_page_settings.sql`; the one existing row takes the defaults.
- [x] `src/instance/home.ts` (pure, unit tested):
  - `DEFAULT_INSTANCE_NAME = "OpenInvites"`, `INSTANCE_NAME_MAX = 40`, `WELCOME_LINE_MAX = 140`, `HOME_POSTER_MODES = ["all", "picked", "one"] as const`, `type HomePosterMode`.
  - `type HomePage = { instanceName: string | null; welcomeLine: string | null; posters: HomePosterMode; posterIds: GalleryPosterId[]; showOperator: boolean }` and `DEFAULT_HOME_PAGE`.
  - `normaliseText(raw: string): string | null`: trim, turn every run of whitespace (line breaks included) into one space, empty → null.
  - `parseHomePage(fields: { instanceName: string; welcomeLine: string; posters: string; posterIds: string[]; showOperator: boolean })` → `{ ok: true; page: HomePage } | { ok: false; field: "instanceName" | "welcomeLine" | "posters"; reason: "tooLong" | "unknownPoster" | "noneChosen" | "chooseOne" }`. Lengths count code points (`Array.from(s).length`), so 40 Chinese characters fit. `picked` needs at least one id, `one` exactly one; an id not in `posters.ts` is `unknownPoster`. With `all`, the ids are stored as `[]`.
  - `posterPool(page: Pick<HomePage, "posters" | "posterIds">): GalleryPosterId[]`: the ids in gallery order; ids no longer in the gallery are skipped; an empty result means every gallery poster.
  - `instanceDisplayName(page: Pick<HomePage, "instanceName">): string`: the name or `DEFAULT_INSTANCE_NAME`.
- [x] `src/instance/repository.ts`: `homePage = cache(async (): Promise<HomePage>)`, the way `instanceLimits` is, which also drops stored ids no longer in the gallery when it reads them; `setHomePage(page: HomePage)`.
- [x] `setHomePageAction` in `src/instance/actions.ts`, behind `requireOperator()`, shaped like `setInstanceLimitsAction`.
- [x] `/instance` gains a **Home page** card, first on the page (`id="home-page"`, so ticket 04 can link to it), in the shape of the other cards (`instance-forms.tsx`). Copy, keys under `Instance.homePage.*`:
  - Title "Home page", description "What visitors see at this site's address."
  - **Name**, placeholder "OpenInvites", hint "Shown on the home page, in the browser tab and in account emails. Leave it empty to use “OpenInvites”."
  - **Welcome line**, hint "One sentence under the name. Leave it empty for the default line."
  - **More options**, a disclosure (button with `aria-expanded`), closed unless the stored settings differ from the defaults:
    - "Posters on the home page", radios: "All gallery posters, a different one each visit" (`all`), "Only the ones I pick" (`picked`), "Always the same poster" (`one`). For `picked`, the gallery as checkboxes, for `one` as a radio group, each a thumbnail (the poster's `card` file) named by its `Posters.names` message, grouped as the editor's Poster sheet groups them by occasion.
    - "Who runs this site", checkbox "Show “Run by” with my display name".
  - Save, then "Saved." Errors beside their field: "Keep the name to 40 characters.", "Keep the welcome line to 140 characters.", "Pick at least one poster.", "Pick the poster to show." (`unknownPoster` is only reachable by a crafted request, so it reads "Pick posters from the gallery.").
- [x] Playwright: a new project `home-instance` in `playwright.config.ts` for `e2e/home-page.spec.ts` (desktop viewport, `baseURL: http://localhost:3002`, `dependencies: ["retention-instance"]`). `mobile` and `desktop` ignore it, as they do the other fresh-instance specs. The spec is serial and recreates `app-fresh` and `db-fresh` first, as `limits.spec.ts` does, because saving these settings on the shared `app` would change what other specs see.
- [x] Unit tests (`src/instance/home.test.ts`): `normaliseText` (spaces, line breaks, empty); `parseHomePage` at 40 and 41 code points for the name, 140 and 141 for the line, 40 Chinese characters accepted; `picked` with none, `one` with two, an unknown id, `all` storing `[]`; `posterPool` for each mode, an unknown stored id skipped, every id unknown falling back to the whole gallery; `instanceDisplayName` with and without a name.
- [x] Browser tests (`e2e/home-page.spec.ts`): the first account signs up and verifies (it is the operator); on `/instance` the Home page card is first; it saves a name and welcome line and sees "Saved."; after a reload the fields hold them; More options is closed; it opens it, chooses "Always the same poster" with no poster picked and sees "Pick the poster to show."; picks Disco and saves; after a reload More options is open with Disco chosen; a 41-character name is refused with its sentence. A second, non-operator host posting to the action (replaying the operator's request from their own session) is refused, and the settings are unchanged.

## Notes for the implementer

- `setInstanceLimitsAction`, `LimitsForm` and `instanceLimits()` are the pattern to follow.
- Gallery ids and their names: `src/themes/posters.ts` (`GALLERY_POSTERS`, `findGalleryPoster`) and `messages/en.json` `Posters.names`.
- Commit subject, e.g. `Instance: the operator names the instance and chooses its home page posters`.

## Comments

**2026-11-04, implementing agent.** Done. `pnpm lint`, `pnpm typecheck`, `pnpm test` (847) pass; `e2e/home-page.spec.ts` passes under the `home-instance` project (Docker test profile, `CI=1`; the run took its dependency chain with it, 29 passed), `e2e/instance-settings.spec.ts` and the instance settings case of `accessibility.spec.ts` still pass on `app`.

How it landed: `src/instance/home.ts` (pure rules, tested first), migration 0041, `homePage()` / `setHomePage()` in the repository, `setHomePageAction`, `HomePageForm` in `instance-forms.tsx`, the card first on `/instance` with `id="home-page"`, `Instance.homePage.*` in all three message files.

Decisions and things to know: inputs are `id="instance-name"` and `id="welcome-line"`. The form keeps its fields in state so a refused save keeps what was typed; its action returns `{ error, field }` so each error shows beside its field. The disclosure content is `hidden`, not unmounted, so it still posts. `HomePageParse` is a discriminated union (same values as the ticket), so the action can type its message key. Duplicate ids are dropped; ids keep the order given and `posterPool` puts them in gallery order. The second host in the spec signs up through a host invitation and the replay reuses the operator's recorded server-action request.

Left for later: ticket 02 extends `e2e/home-page.spec.ts` and `src/instance/home.ts`. Chinese strings least sure of: `showOperator` ("运营者"/"營運者") and `postersMode.all`.

Evidence: RED was `vitest run src/instance/home.test.ts` failing to load `./home` (no module); GREEN was 18 passed after `home.ts`.
