import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// The modules (ADR-0008): a feature in its own folder, with one public entry file. Nothing outside a
// module imports its other files, by the alias or by a relative path; inside, its own files are
// free, and another module's are not.
const MODULES = ["features", "voting", "sections"];

// A relative path reaches src/<name>/ only by climbing exactly as many folders as the importing
// file sits below src/: "./" from src/ itself, "../" from one folder down, and so on. So the rule
// is written once per depth (M8 ticket 24): a pattern that took any number of "../" would also
// catch an unrelated folder of the same name, such as src/themes/sections/ from
// src/themes/effects/. The deepest file in src/ is 7 folders down today; DEPTHS leaves room.
const DEPTHS = 12;
const climbing = (depth) => (depth === 0 ? "\\./" : `(\\.\\./){${depth}}`);
const reachingInto = (depth) => (name) => ({
  regex: `^(@/|${climbing(depth)})${name}/`,
  message: `Import ${name} through "@/${name}" (ADR-0008).`,
});
const filesAt = (folder, depth) => [`${folder}/${"*/".repeat(depth)}*.{ts,tsx}`];

// Per depth, one block for the app outside the modules, and one per module with the other two: a
// later block's options for the same rule replace an earlier one's, so the module blocks cannot
// add to it.
const moduleBoundaries = Array.from({ length: DEPTHS }, (_, depth) => [
  {
    files: filesAt("src", depth),
    ignores: MODULES.map((name) => `src/${name}/**`),
    rules: { "no-restricted-imports": ["error", { patterns: MODULES.map(reachingInto(depth)) }] },
  },
  ...(depth === 0
    ? []
    : MODULES.map((module) => ({
        files: filesAt(`src/${module}`, depth - 1),
        rules: { "no-restricted-imports": ["error", { patterns: MODULES.filter((name) => name !== module).map(reachingInto(depth)) }] },
      }))),
]).flat();

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...moduleBoundaries,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Ours:
    ".claude/**",
    "playwright-report/**",
    "test-results/**",
    "coverage/**",
  ]),
]);

export default eslintConfig;
