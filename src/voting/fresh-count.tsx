"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

// A count read as a confirmation that deletes what it counts opens (review fix, M8 ticket 13),
// since the figure the page was drawn with may be old by the time the host presses: the votes that
// Turn off voting and removing an award delete, and those of a tie-break that reopening ends (the
// voting part's review, finding 1). Until the read answers, the confirmation gives no figure and
// cannot be confirmed; if it fails, it says so, and only Never mind is left (review fix, ticket
// 14). An answer to an earlier opening is ignored.
type Fresh<T> = { state: "reading" } | { state: "failed" } | { state: "read"; value: T };

export function useFresh<T>(load: () => Promise<T | null>) {
  const [fresh, setFresh] = useState<Fresh<T>>({ state: "reading" });
  const latest = useRef(0);
  // Read again each time the confirmation opens.
  const read = (open: boolean) => {
    if (!open) return;
    const mine = ++latest.current;
    const answered = (next: Fresh<T>) => {
      if (mine === latest.current) setFresh(next);
    };
    setFresh({ state: "reading" });
    load().then(
      (value) => answered(value === null ? { state: "failed" } : { state: "read", value }),
      () => answered({ state: "failed" }),
    );
  };
  return { read, value: fresh.state === "read" ? fresh.value : undefined, ready: fresh.state === "read", failed: fresh.state === "failed" };
}

// A confirmation's text: what it deletes, once the count is read (`count`), or that it is being
// read, or that it could not be.
export function CountText({ failed, count, text }: { failed: boolean; count: number | undefined; text: (count: number) => string }) {
  const t = useTranslations("Voting.block");
  if (count !== undefined) return text(count);
  return t(failed ? "countFailed" : "counting");
}
