# Translations

Every word the interface shows, and every email it sends, lives in a translation file in [`messages/`](../../messages/), one per language. Improving a translation, or adding a language, needs no application code beyond registering the language.

| File | Language |
| --- | --- |
| `messages/en.json` | English, the source. Every message is written here first. |
| `messages/zh-Hans.json` | Simplified Chinese, as written in mainland China. |
| `messages/zh-Hant.json` | Traditional Chinese, as written in Taiwan. |

## The shape

Each file is one JSON object, organised by screen: the top-level keys are namespaces such as `Auth`, `Host`, `Events`, `EventPage`, `DesignDrawer`, `Rsvp`, `Guests` and `Mail`. A string shown on two screens is in both namespaces; screens never share a key. The names of templates, backgrounds, title fonts and accent colours are messages too, in `DesignDrawer` (`templateNames`, `templateBlurbs`, `backgroundNames`, `fontNames`, `swatches`), keyed by the ids in their data files. `Locales` names each language in its own script, for the language switcher in every page's footer.

Messages are in ICU message format, which [next-intl](https://next-intl.dev/) reads:

| In English | What to keep |
| --- | --- |
| `Hello, {name}.` | Every placeholder, spelled as in English. |
| `Up to {max, number} MB.` | How each placeholder is used: as a number, a plural, a select, or plain. |
| `{count, plural, =0 {No one yet} =1 {1 person expected} other {# people expected}}` | `other` and its `#`. Use your language's own plural categories ([CLDR](https://www.unicode.org/cldr/charts/latest/supplemental/language_plural_rules.html)) and no others: English has `one` and `other`, Chinese only `other`. An exact `=0` or `=1` is fine wherever the sentence reads differently. |
| `{tone, select, light {Light} dark {Dark} other {Auto}}` | Every branch. |
| `Write to <link>{email}</link>.` | Every tag, around the words that should be the link or the bold text. |

What hosts write (titles, descriptions, questions) is shown as they wrote it. Dates, times and numbers are formatted for each language by the browser's `Intl`, and are not in the files.

## Improving a translation

Edit the file, run `pnpm test`, and look at the screen in the language: with `pnpm dev` running, choose it in the footer of any page. The choice is kept in a cookie. Check it at a phone's width too, where a longer word can crowd a button.

## Adding a language

1. Copy `messages/en.json` to `messages/<tag>.json`, where `<tag>` is the language's [BCP 47 tag](https://www.w3.org/International/articles/language-tags/), such as `fr`, `pt-BR` or `ja`, and translate every message.
2. Register it in [`src/locale/resolve-locale.ts`](../../src/locale/resolve-locale.ts):
   - add the tag to `locales`, in the order the switcher should list it;
   - teach `matchLocale` which tags a browser may send for it (for French, `fr`, `fr-FR`, `fr-CA` and so on all mean `fr`). A browser asking only for languages that match nothing gets English.
3. Name it in its own language under `Locales` in every file in `messages/`, such as `"fr": "Français"`, so every language's switcher can offer it.
4. Run `pnpm typecheck` and `pnpm test`.

The translation test, [`src/locale/translations.test.ts`](../../src/locale/translations.test.ts), checks every language in `locales` other than English, message by message. Every message English has must be there and nothing else, none may be empty, and each must parse, keep English's placeholders and use them the same way, keep a select's branches and a plural's `#`, and give a plural only the branches its language uses. It names each problem, such as `Rsvp.hello lacks {name}`, so a new file can be finished by working down the list.

## When English gains a message

A message added to `en.json` has to be added to every other file in the same change: the translation test fails until it is. At run time a message a language lacks shows in English ([`src/locale/fallback.ts`](../../src/locale/fallback.ts)), never as its key. If you cannot write one of the languages, say so in the pull request and ask for help.
