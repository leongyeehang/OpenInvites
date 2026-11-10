// A Range header against a file of a known size (M7 ticket 04), for the uploads route: one
// range, `bytes=a-b`, `bytes=a-` or `bytes=-n` (the last n bytes), clamped to the file's last
// byte; `end` is inclusive. Nothing for no header, or for several ranges, which the route then
// answers whole with 200 (allowed); "unsatisfiable" for a start past the end, an end before the
// start, an empty suffix, another unit or nonsense, which the route answers with 416.
export function parseRange(header: string | null, size: number): { start: number; end: number } | "unsatisfiable" | undefined {
  if (!header) return undefined;
  const unit = /^bytes=(.*)$/i.exec(header.trim());
  if (!unit) return "unsatisfiable";
  const spec = unit[1].trim();
  if (spec.includes(",")) return undefined;
  const parts = /^(\d*)-(\d*)$/.exec(spec);
  if (!parts || (parts[1] === "" && parts[2] === "")) return "unsatisfiable";
  if (parts[1] === "") {
    const suffix = Number(parts[2]);
    if (suffix === 0 || size === 0) return "unsatisfiable";
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }
  const start = Number(parts[1]);
  if (start >= size) return "unsatisfiable";
  const end = parts[2] === "" ? size - 1 : Math.min(Number(parts[2]), size - 1);
  if (end < start) return "unsatisfiable";
  return { start, end };
}
