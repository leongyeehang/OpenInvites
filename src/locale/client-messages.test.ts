import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Ticket 20: each page sends its client components the messages they read, and only those
// (client-messages.tsx). This reads the source as the bundler does. From each page and layout it
// follows every import of the project's own modules, and theirs, down to the packages; a module
// marked "use client", and everything it imports, runs in the browser. The namespaces those
// modules pass to useTranslations must each be passed to a <ClientMessages> by the page's server
// modules, and each namespace passed must be read by one of those client modules. A missing
// message in the browser shows its key in place of the words, which is worse than a larger page.

const SRC = fileURLToPath(new URL("..", import.meta.url));
const APP = join(SRC, "app");
const ENTRIES = new Set(["page.tsx", "layout.tsx", "not-found.tsx", "error.tsx", "template.tsx", "default.tsx", "loading.tsx"]);

function entries(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
    const path = join(dir, item.name);
    if (item.isDirectory()) return entries(path);
    return ENTRIES.has(item.name) ? [path] : [];
  });
}

// The source without its whole-line comments, which may name what the code does not do.
function code(path: string): string {
  return readFileSync(path, "utf8").replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

// Every module a module loads when it runs: static imports and re-exports (not type-only ones),
// side-effect imports, and dynamic import(); each with the names it takes where it takes only
// named bindings (`import { a, b as c }`), which a module's entry is followed by (`through`).
type Import = { specifier: string; names?: string[] };

// The bindings of a `{ … }` clause, type-only ones left out: each as the module that exports it
// calls it, then as the importer does (`["b", "c"]` for `b as c`).
const bindings = (clause: string) =>
  clause
    .split(",")
    .map((each) => each.trim())
    .filter((each) => each !== "" && !each.startsWith("type "))
    .map((each) => each.split(/\s+as\s+/));

function imports(source: string): Import[] {
  const statics = [...source.matchAll(/(?:^|[\n;])\s*(?:import|export)\s+(?!type\s)([^'";]*?\sfrom\s+)?["']([^"']+)["']/g)].map(([, clause, specifier]) => {
    const braces = clause?.trim().match(/^\{([^}]*)\}\s+from$/);
    return { specifier, names: braces ? bindings(braces[1]).map(([name]) => name) : undefined };
  });
  const dynamics = [...source.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g)].map(([, specifier]) => ({ specifier }));
  return [...statics, ...dynamics];
}

// A module's entry (ADR-0008, `src/voting/index.ts`) is nothing but re-exports, and the bundler
// takes from it only the files whose exports are used: an import of some names from it leads to
// the files that export those names (and to every `export *`, which may), not to the rest. Any
// other file, or an import of the whole module, is the file itself.
const REEXPORT = /export\s+(\*|\{[^}]*\})\s+from\s+["']([^"']+)["'];?/g;

function through(path: string, names: string[] | undefined): string[] {
  const source = code(path);
  if (names === undefined || source.replace(REEXPORT, "").trim() !== "") return [path];
  return [...source.matchAll(REEXPORT)].flatMap(([, clause, specifier]) => {
    const next = resolved(path, specifier);
    if (!next) return [];
    if (clause === "*") return through(next, names);
    const taken = bindings(clause.slice(1, -1))
      .filter((each) => names.includes(each.at(-1)!))
      .map(([name]) => name);
    return taken.length > 0 ? through(next, taken) : [];
  });
}

// The project's own module an import names, or undefined for a package.
function resolved(from: string, specifier: string): string | undefined {
  if (!specifier.startsWith("@/") && !specifier.startsWith(".")) return undefined;
  const base = specifier.startsWith("@/") ? join(SRC, specifier.slice(2)) : join(dirname(from), specifier);
  if (/\.(json|css)$/.test(base)) return undefined;
  const found = [`${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx"), base].find((candidate) => existsSync(candidate) && !candidate.endsWith("/"));
  if (!found) throw new Error(`${relative(SRC, from)} imports ${specifier}, which is not there`);
  return found;
}

type Found = { used: Map<string, string[]>; passed: string[]; problems: string[] };

// What a page's modules read and pass. A module can run on both sides (a server component and a
// client one may import the same file), so it is visited once as each.
function walk(entry: string): Found {
  const found: Found = { used: new Map(), passed: [], problems: [] };
  const seen = new Set<string>();
  const visit = (path: string, inClient: boolean) => {
    const source = code(path);
    const client = inClient || /^\s*["']use client["']/.test(source);
    const key = `${client}:${path}`;
    if (seen.has(key)) return;
    seen.add(key);
    const where = relative(SRC, path);
    // A module of server actions renders nothing: a client component that imports one holds only a
    // reference to each action, so what the actions import sends the browser no messages (M8
    // ticket 10). Otherwise every page with a Duplicate button would send the album vote's.
    if (/^\s*["']use server["']/.test(source)) return;
    if (client) {
      for (const [, argument] of source.matchAll(/\buseTranslations\(([^)]*)\)/g)) {
        const namespace = argument.trim().match(/^["']([^"']+)["']$/)?.[1];
        if (namespace) found.used.set(namespace, [...new Set([...(found.used.get(namespace) ?? []), where])]);
        else found.problems.push(`${where} calls useTranslations(${argument}): name the namespace, so its page can pass it`);
      }
    } else {
      const uses = [...source.matchAll(/<ClientMessages\b/g)].length;
      const lists = [...source.matchAll(/<ClientMessages\s+namespaces=\{\[([^\]]*)\]\}/g)];
      if (lists.length !== uses) found.problems.push(`${where} passes <ClientMessages> namespaces that are not written out as a list`);
      for (const [, list] of lists) found.passed.push(...[...list.matchAll(/["']([^"']+)["']/g)].map((match) => match[1]));
    }
    for (const { specifier, names } of imports(source)) {
      const next = resolved(path, specifier);
      if (next) for (const file of through(next, names)) visit(file, client);
    }
  };
  visit(entry, false);
  return found;
}

const covers = (passed: string, used: string) => used === passed || used.startsWith(`${passed}.`);

describe("the messages each page sends to the browser", () => {
  for (const entry of entries(APP)) {
    it(relative(SRC, entry), () => {
      const { used, passed, problems } = walk(entry);
      const missing = [...used].filter(([namespace]) => !passed.some((given) => covers(given, namespace))).map(([namespace, readers]) => `${namespace} (read by ${readers.join(", ")})`);
      const unread = passed.filter((given) => ![...used.keys()].some((namespace) => covers(given, namespace)));
      expect(problems).toEqual([]);
      expect(missing, "read in the browser but not passed").toEqual([]);
      expect(unread, "passed but read by no client component").toEqual([]);
    });
  }

  it("follows imports into client components", () => {
    // The event page reads RSVP messages in the browser, through the client components it imports:
    // the Poster's flow, the Broadsheet's ballot and the receipt the ballot imports, and the
    // Thread's composer.
    const { used } = walk(join(APP, "e/[slug]/page.tsx"));
    expect(used.get("Rsvp")).toEqual([
      "app/e/[slug]/broadsheet-ballot.tsx",
      "app/e/[slug]/broadsheet-receipt.tsx",
      "app/e/[slug]/rsvp-flow.tsx",
      "app/e/[slug]/thread-composer.tsx",
    ]);
    // The editor's design sheets read theirs, through the editor page.
    expect(walk(join(APP, "(editor)/events/[id]/page.tsx")).used.get("Design")).toEqual(expect.arrayContaining(["editor/design-sheets.tsx"]));
  });

  it("stops at a module of server actions", () => {
    // The share page imports events/actions.ts, whose Duplicate imports the album vote's entry,
    // which carries the Voting block: none of that reaches the browser through an action.
    expect(walk(join(APP, "(host)/events/[id]/share/page.tsx")).used.has("Voting.block")).toBe(false);
    expect(walk(join(APP, "(editor)/events/[id]/page.tsx")).used.get("Voting.block")).toEqual(["voting/voting-block.tsx", "voting/fresh-count.tsx", "voting/reopen-voting.tsx"]);
  });

  it("follows a module's entry only to the files whose exports are imported", () => {
    // The event page imports albumVotingFor from the album vote's entry (M8 ticket 11), which also
    // carries the Voting block: the page draws only the album's side of the vote, whose head reads
    // the block's Close voting and Reopen voting too (ticket 12), with Reopen voting's confirmation
    // (the voting part's review), never the block itself.
    const used = walk(join(APP, "e/[slug]/page.tsx")).used;
    expect(used.get("Voting.block")).toEqual(["voting/album-voting-head.tsx", "voting/reopen-voting.tsx", "voting/fresh-count.tsx"]);
  });
});
