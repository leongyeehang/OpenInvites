# 03: Site settings: the Storage card

**What to build:** A Storage card on Site settings that answers "how full is my site?": the counted use split into albums and pictures, the real disk use and free space on local disk, whether the one-time measuring is still running, the five events using the most, and the switch "Process videos for playback".

**Blocked by:** 02 Storage: every upload records its size

**Status:** ready-for-agent

- [ ] `src/storage/usage.ts` gains `biggestAlbums(limit = 5): Promise<{ id: string; title: string; slug: string; customSlug: string | null; bytes: number; items: number; hosts: EventHost[] }[]>`: `photo` grouped by `event_id`, ordered by the sum descending, joined to `event`, hosts through `eventHosts` (`src/events/hosts.ts:12-24`, owner first).
- [ ] `src/app/instance/page.tsx`: a `<Card id="storage">` after the Limits card (`:73-85`), its data loaded in the page's `Promise.all` (`:27-34`). Server-rendered: "In use" as albums, pictures and the total (`formatSize`); on local disk "On the disk" (`diskUse()`) and "Free" (`freeDiskBytes()`); on S3 one line saying the counted use is all the site can know of a bucket; "Still measuring {count} files from before the upgrade" while `unmeasuredCount() > 0`; the biggest albums as a list of rows: the title linked to the public event page (`eventUrl`), the hosts' names and emails, the use and the item count. **(plan ruling 2: no link to another host's manage page, which the operator cannot open; the Reports page is the model.)** Clear the album comes in ticket 10; the processing status line in tickets 05 and 08.
- [ ] The switch: a small client form `StorageForm` in `src/app/instance/instance-forms.tsx` with one Checkbox "Process videos for playback" (checked = `videoProcessing`) and the hint "On: a lighter copy is made of every clip that needs one, so it plays on slow connections and in every browser. Off: clips are kept as sent and play where the browser can.", saved by `setVideoProcessingAction(_: FormState, formData)` in `src/instance/actions.ts` (`requireOperator`, updates `instance_settings.video_processing`, `revalidatePath("/instance")`), with `FormOutcome` and a Save button as `LimitsForm` has. `instanceLimits()` does not carry it; a `videoProcessing(db?)` reader in `src/instance/repository.ts` does, for ticket 06.
- [ ] Messages `Instance.storage.*` (title, description, inUse, albums, pictures, total, onDisk, free, bucketNote, measuring with a plural, biggest, items with a plural, processVideos, processVideosHint, submit, saved) in the three locales; `<ClientMessages namespaces={["Instance.storage"]}>` wraps only the client form (`client-messages.test.ts` fails on a namespace passed but not read).
- [ ] Browser: `e2e/limits.spec.ts` (`limits-instance`): after the two photos ticket 02's row adds, the Storage card shows albums as the two files' summed size (`formatSize` of the known buffers) and the event among the biggest with its host's name; the switch turns off, survives a reload, and turns on again. `e2e/instance-settings.spec.ts` (the shared `app`): the card is present with its headings and at most five rows (its numbers are not predictable there). Axe on Site settings with the card (`expectNoSeriousViolations`).
- [ ] Docs: `docs/operator/configuration.md`, a `### Storage` subsection before `### Retention` (`:156`) describing the card and the switch in a paragraph; ticket 11 completes it.

## Notes for the implementer

- The disk figures are read when the page renders, O(files) in the uploads directory; that is fine for a settings page.
- Commit subject, e.g. `Site settings: a Storage card shows what the site uses`.

## Comments
