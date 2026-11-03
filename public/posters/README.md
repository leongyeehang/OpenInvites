# Gallery posters

The ready-made posters a host can pick for an invitation. They are drawn as code in [`scripts/posters/art.ts`](../../scripts/posters/art.ts) and built into these files by `pnpm posters` ([`docs/contributing/posters.md`](../../docs/contributing/posters.md)). Do not edit them by hand.

- `<name>.<hash>.svg`: the poster the page shows.
- `<name>.<hash>.jpg`: the same poster as a JPEG, for the link's preview card.
- `<name>-copy.<hash>.webp`: the small copy the page blurs behind the poster.

Each file is named after its content, since browsers keep it for a year.

They are part of OpenInvites and, like the rest of it, licensed under the GNU Affero General Public License, version 3 or later ([`LICENSE`](../../LICENSE)).
