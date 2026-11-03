# 07: The Settings sheet

**What to build:** Everything a guest does not see, in one tall sheet from the editor's toolbar, grouped as the mockup groups it, with the 0.4 defaults and validation.

**Blocked by:** 05 The invitation is the editor

**Status:** ready-for-agent

- [ ] Groups and controls (spec, "The editor"): **Guests** (each guest can bring 0–10, ask for their names, capacity with the 0.4 hint, approve each reply); **Questions** (the 0.4 questions editor inside the sheet, answer counts kept); **Contact details** (email Don't ask / Optional / Required, prove it with a code (only with mail configured, and disabled while email is not asked), phone); **Guest list** (who sees who's coming); **Emails and comments** (email me on replies, reminders with the "ask for an email" hint, comments, email me about comments).
- [ ] Each control saves on change through one `updateEventSettingsAction` that reuses `events/form.ts`'s parsing and limits per field; errors show beside the control.
- [ ] One line at the top: "Everything a guest doesn't see. The defaults are ready, so you can publish without opening this."
- [ ] Remove the temporary Settings sheet of ticket 05.
- [ ] Browser: each setting saved and honoured by the guest's flow (plus-ones offered, capacity waitlists, approval holds, email required, phone asked, guest list hidden, comments off); the questions editor's rows of `questions.spec.ts` run in the sheet. Keyboard and accessibility rows.

## Notes for the implementer

- Commit subject, e.g. `Editor: the settings guests never see, in one sheet`.
