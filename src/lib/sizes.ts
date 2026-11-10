// How sizes and lengths read to people (M7 ticket 01): the interface writes "40 MB", "1.5 GB",
// "15 min" and "1:05", never raw bytes. Units are binary, as MAX_UPLOAD_MB was.

export const MEGABYTE = 1024 * 1024;
export const GIGABYTE = 1024 * MEGABYTE;

// Megabytes below a gigabyte, gigabytes from one on, with at most one decimal. A size that is not
// nothing never reads as nothing: under a tenth of a megabyte is written as one tenth.
export function formatSize(bytes: number, locale: string): string {
  const unit = bytes >= GIGABYTE ? "gigabyte" : "megabyte";
  const raw = bytes / (unit === "gigabyte" ? GIGABYTE : MEGABYTE);
  const value = bytes > 0 ? Math.max(raw, 0.1) : 0;
  return new Intl.NumberFormat(locale, { style: "unit", unit, unitDisplay: "short", maximumFractionDigits: 1 }).format(value);
}

export function formatMinutes(minutes: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "unit", unit: "minute", unitDisplay: "short", maximumFractionDigits: 0 }).format(minutes);
}

// A length as a clock reads it: "0:07", "1:05", "1:02:03".
export function clockTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const two = (n: number) => String(n).padStart(2, "0");
  return hours > 0 ? `${hours}:${two(minutes)}:${two(seconds)}` : `${minutes}:${two(seconds)}`;
}
