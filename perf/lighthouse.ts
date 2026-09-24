import { chromium } from "@playwright/test";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

// One Lighthouse audit of a page, as its command line runs one: a fresh Chromium for each run,
// Lighthouse's default mobile profile (a mid-range phone on slow 4G, throttling simulated), the
// performance category only. The Chromium is Playwright's own, through CHROME_PATH, unless one
// is named already. Lighthouse reports its own errors to its makers when a user has said yes to
// that once (it keeps the answer in its settings), so every run says no on its command line.

const LIGHTHOUSE = resolve("node_modules/lighthouse/cli/index.js");

export type Run = {
  score: number;
  lcp: number;
  tbt: number;
  cls: number;
  fcp: number;
  si: number;
  lcpElement: string;
  // What Lighthouse says would gain the most, largest first, as it words it.
  opportunities: string[];
};

type Audit = {
  title: string;
  score: number | null;
  scoreDisplayMode: string;
  numericValue?: number;
  displayValue?: string;
  metricSavings?: Record<string, number>;
  details?: { type?: string; overallSavingsBytes?: number; items?: unknown[] };
};
type Report = { categories: { performance: { score: number; auditRefs: { id: string; group?: string }[] } }; audits: Record<string, Audit> };

export async function audit(url: string, headers: Record<string, string>, reportPath: string): Promise<Run> {
  // Chromium's profile is made here and removed after: under WSL, Lighthouse would name a Windows
  // folder, which a Linux Chromium makes in the working directory and leaves there.
  const profile = await mkdtemp(join(tmpdir(), "openinvites-perf-"));
  try {
    await promisify(execFile)(
      process.execPath,
      [
        LIGHTHOUSE,
        url,
        "--only-categories=performance",
        "--no-enable-error-reporting",
        "--output=json",
        `--output-path=${reportPath}`,
        `--chrome-flags=--headless=new --user-data-dir=${profile}`,
        `--extra-headers=${JSON.stringify(headers)}`,
        "--quiet",
      ],
      { env: { ...process.env, CHROME_PATH: process.env.CHROME_PATH || chromium.executablePath() } },
    );
  } finally {
    await rm(profile, { recursive: true, force: true });
  }
  const report = JSON.parse(await readFile(reportPath, "utf8")) as Report;
  const value = (id: string) => report.audits[id].numericValue ?? NaN;
  return {
    score: Math.round(report.categories.performance.score * 100),
    lcp: value("largest-contentful-paint"),
    tbt: value("total-blocking-time"),
    cls: value("cumulative-layout-shift"),
    fcp: value("first-contentful-paint"),
    si: value("speed-index"),
    lcpElement: lcpElement(report),
    opportunities: opportunities(report),
  };
}

// The element Lighthouse found to be the largest paint, as a selector and its text.
function lcpElement(report: Report): string {
  const items = (report.audits["lcp-breakdown-insight"]?.details?.items ?? []) as { type?: string; selector?: string; nodeLabel?: string }[];
  const node = items.find((item) => item.type === "node");
  return node ? `${node.selector ?? "?"} "${(node.nodeLabel ?? "").slice(0, 40)}"` : "none found";
}

// The insights and diagnostics that did not pass and promise the page time or bytes back.
function opportunities(report: Report): string[] {
  const found = report.categories.performance.auditRefs
    .filter(({ group }) => group === "insights" || group === "diagnostics")
    .map(({ id }) => report.audits[id])
    .filter((audit) => audit.score !== null && audit.score < 1 && audit.scoreDisplayMode !== "informative")
    .map((audit) => {
      const savings = audit.metricSavings ?? {};
      const ms = Math.max(savings.LCP ?? 0, savings.FCP ?? 0, savings.TBT ?? 0);
      const bytes = audit.details?.overallSavingsBytes ?? 0;
      const what = [
        ...Object.entries(savings)
          .filter(([, saved]) => saved > 0)
          .map(([metric, saved]) => `${metric} ${metric === "CLS" ? saved.toFixed(3) : `${Math.round(saved)} ms`}`),
        bytes > 0 ? `${Math.round(bytes / 1024)} KiB` : "",
      ].filter(Boolean);
      return { ms, bytes, text: `${audit.title}${audit.displayValue ? ` (${audit.displayValue})` : ""}${what.length ? `: ${what.join(", ")}` : ""}` };
    });
  return found.sort((a, b) => b.ms - a.ms || b.bytes - a.bytes).map(({ text }) => text);
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

// The median of each measure, and the median run's element and opportunities (the run whose score
// is the median, as the score is what is judged).
export function summarise(runs: Run[]): Run {
  const middle = [...runs].sort((a, b) => a.score - b.score)[Math.floor(runs.length / 2)];
  return {
    score: median(runs.map((run) => run.score)),
    lcp: median(runs.map((run) => run.lcp)),
    tbt: median(runs.map((run) => run.tbt)),
    cls: median(runs.map((run) => run.cls)),
    fcp: median(runs.map((run) => run.fcp)),
    si: median(runs.map((run) => run.si)),
    lcpElement: middle.lcpElement,
    opportunities: middle.opportunities,
  };
}

export function describe(name: string, runs: Run[], summary: Run): string {
  const ms = (value: number) => `${(value / 1000).toFixed(2)} s`;
  return [
    `${name}: performance ${summary.score} (runs ${runs.map((run) => run.score).join(", ")})`,
    `  FCP ${ms(summary.fcp)}, LCP ${ms(summary.lcp)}, TBT ${Math.round(summary.tbt)} ms, CLS ${summary.cls.toFixed(3)}, Speed Index ${ms(summary.si)}`,
    `  largest paint: ${summary.lcpElement}`,
    ...summary.opportunities.slice(0, 5).map((text) => `  - ${text}`),
  ].join("\n");
}
