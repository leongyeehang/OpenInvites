// An id as Postgres writes a UUID. Checked before an id from a URL reaches a query or a file name.
export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
}

// When a UUIDv7 was made: its first 48 bits are milliseconds since the epoch (Postgres makes every
// row's id so; M7 ticket 10 reads a file's age from it). Nothing for another version or no UUID.
export function uuidv7Time(value: string): Date | undefined {
  if (!isUuid(value) || value[14] !== "7") return undefined;
  return new Date(parseInt(value.slice(0, 8) + value.slice(9, 13), 16));
}
