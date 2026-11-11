import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// The modules (ADR-0008): a feature in its own folder, with one public entry file. Nothing outside a
// module imports its other files, by the alias or by a relative path; inside, its own files are
// free, and another module's are not.
const MODULES = ["features", "voting", "sections"];
const reachingInto = (name) => ({ regex: `^(@/|(\\.\\./)+)${name}/`, message: `Import ${name} through "@/${name}" (ADR-0008).` });

// One block for the app outside the modules, and one per module with the other two: a later
// block's options for the same rule replace an earlier one's, so the module blocks cannot add to it.
const moduleBoundaries = [
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: MODULES.map((name) => `src/${name}/**`),
    rules: { "no-restricted-imports": ["error", { patterns: MODULES.map(reachingInto) }] },
  },
  ...MODULES.map((module) => ({
    files: [`src/${module}/**/*.{ts,tsx}`],
    rules: { "no-restricted-imports": ["error", { patterns: MODULES.filter((name) => name !== module).map(reachingInto) }] },
  })),
];

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
