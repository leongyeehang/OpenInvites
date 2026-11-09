// What a field shows once a server action has saved it (M6 final review): what the server kept, as
// it kept it, while the field still holds what was sent; what the person typed since, when they
// typed on while it saved, which the next save sends.
export function adoptSaved({ current, submitted, kept }: { current: string; submitted: string; kept: string }): string {
  return current === submitted ? kept : current;
}
