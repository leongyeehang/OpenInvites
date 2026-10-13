// A long list cut into runs of `size`, for writes that would otherwise bind more parameters than
// Postgres takes in one statement (65,535).
export function chunks<T>(items: T[], size: number): T[][] {
  const runs: T[][] = [];
  for (let start = 0; start < items.length; start += size) runs.push(items.slice(start, start + size));
  return runs;
}
