// A first-time social sign-in takes the provider profile's name (spec, "Identity and access").
// GitHub already falls back to the login when a profile has none; this covers what's left,
// such as Google without a name, by falling back to the part of the email before the @.
export function fallbackDisplayName(input: { name?: string | null; email: string }): string {
  const name = input.name?.trim();
  if (name) return name;
  return input.email.split("@")[0]?.trim() || input.email;
}
