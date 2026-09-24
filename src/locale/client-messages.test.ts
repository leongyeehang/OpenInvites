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
// side-effect imports, and dynamic import().
function imports(source: string): string[] {
  const statics = [...source.matchAll(/(?:^|[\n;])\s*(?:import|export)\s+(?!type\s)(?:[^'";]*?\sfrom\s+)?["']([^"']+)["']/g)];
  const dynamics = [...source.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g)];
  return [...statics, ...dynamics].map((match) => match[1]);
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
    for (const specifier of imports(source)) {
      const next = resolved(path, specifier);
      if (next) visit(next, client);
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
    // The event page reads RSVP messages in the browser, through a client component it imports.
    const { used } = walk(join(APP, "e/[slug]/page.tsx"));
    expect(used.get("Rsvp")).toEqual(["app/e/[slug]/rsvp-flow.tsx"]);
    // The Design panel is fetched on its own, when the host opens it, and read too.
    expect(used.get("DesignDrawer")).toEqual(expect.arrayContaining(["app/e/[slug]/design-panel.tsx"]));
  });
});
