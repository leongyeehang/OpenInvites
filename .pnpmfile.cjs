// Lighthouse, the dev dependency `pnpm perf` runs, brings @opentelemetry/api with it (through
// @sentry/node). Next.js, better-auth and Drizzle each name it as an optional peer, and pnpm
// gives a package its optional peer whenever the tree holds one, so the production image would
// have loaded a module a test tool chose. None of them needs it, and each goes without when it is
// not there, as before Lighthouse came: so they are not given it. The Dockerfile copies this file
// for its install, which the lockfile's checksum of it requires.
const WITHOUT_OPENTELEMETRY = new Set(["next", "@better-auth/core", "drizzle-orm"]);

function readPackage(pkg) {
  if (WITHOUT_OPENTELEMETRY.has(pkg.name)) {
    delete pkg.peerDependencies?.["@opentelemetry/api"];
    delete pkg.peerDependenciesMeta?.["@opentelemetry/api"];
  }
  return pkg;
}

module.exports = { hooks: { readPackage } };
