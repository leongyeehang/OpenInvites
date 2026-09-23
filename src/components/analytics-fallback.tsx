"use client";

import { useEffect } from "react";
import { HEAD_READ_MARKER } from "./analytics";

// When the browser did not read the head itself (analytics.ts), each of the snippet's scripts is
// swapped for a copy made as the parser would have made it, which runs, once, in the order given.
export function AnalyticsFallback({ snippet }: { snippet: string }) {
  useEffect(() => {
    const marked = window as unknown as Record<string, unknown>;
    if (marked[HEAD_READ_MARKER]) return;
    marked[HEAD_READ_MARKER] = true;
    const given = document.createElement("template");
    given.innerHTML = snippet;
    for (const script of given.content.querySelectorAll("script")) {
      const copy = document.createElement("script");
      for (const { name, value } of script.attributes) copy.setAttribute(name, value);
      // A script the parser meets without async runs in order; one made here would not.
      if (!script.hasAttribute("async")) copy.async = false;
      copy.text = script.text;
      const inert = [...document.head.querySelectorAll("script")].find((each) => each.outerHTML === script.outerHTML);
      if (inert) inert.replaceWith(copy);
      else document.head.append(copy);
    }
  }, [snippet]);
  return null;
}
