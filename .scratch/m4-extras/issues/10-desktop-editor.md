# 10: The editor on a desktop

**What to build:** On wide screens the invitation stays phone-width in the centre, the toolbar floats under it, and every sheet opens as a side panel to the right without shrinking the invitation.

**Blocked by:** 06 Design sheets, 07 The Settings sheet

**Status:** ready-for-agent

- [ ] At `lg` and up: the invitation column `max-w-[28rem]` centred; the toolbar a floating bar under it; sheets a right-hand panel (`w-[24rem]`), the invitation sliding left to stay in view, not scaled. Below `lg`, the phone behaviour.
- [ ] The More menu and the share sheet behave the same at both widths.
- [ ] Browser at 1280×800: each sheet opens beside the invitation and the invitation stays visible and unscaled; keyboard and accessibility rows.

## Notes for the implementer

- Commit subject, e.g. `Editor: on a desktop the sheets open beside the invitation`.
