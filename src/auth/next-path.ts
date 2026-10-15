// Where signing in leads: back to the page that sent the visitor to sign in (a co-host link), when
// it names one on this instance, or else the dashboard. Only a path is followed: a slash and then
// printable characters, with no second slash or backslash anywhere, which a browser could read as
// the start of another address, and no spaces or control characters, which it would drop first.
const DASHBOARD = "/dashboard";

export function nextPath(value: unknown): string {
  if (typeof value !== "string" || !/^\/[\x21-\x7e]+$/.test(value)) return DASHBOARD;
  if (value.includes("//") || value.includes("\\")) return DASHBOARD;
  return value;
}
