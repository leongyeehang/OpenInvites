#!/usr/bin/env bash
# Starts the deployment package with a given image, as an operator would, and checks that it
# comes up healthy:
#
#   deploy/smoke-test.sh ghcr.io/leongyeehang/openinvites:1.2.3
#
# It runs a copy of compose.yaml in a throwaway directory and Compose project of its own, with a
# .env holding only the required values (so no Caddy, and the app on a free port of the
# loopback). Both health checks must pass: Postgres answering, and the app having migrated its
# database. Then it calls /api/health through the published port, checks the app runs as a
# user other than root, that the picture library loads on this machine's architecture, and
# that the password reset command reaches the database. The project and its volumes are removed
# afterwards, pass or fail.
set -euo pipefail

image="${1:?Usage: deploy/smoke-test.sh <image>}"
deploy="$(cd "$(dirname "$0")" && pwd)"
work="$(mktemp -d)"
project="openinvites-smoke-$$"

compose() { docker compose --project-name "$project" --project-directory "$work" --file "$work/compose.yaml" "$@"; }
secret() { head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'; }

cleanup() {
  compose down --volumes --remove-orphans >/dev/null 2>&1 || true
  rm -rf "$work"
}
trap cleanup EXIT

cp "$deploy/compose.yaml" "$deploy/Caddyfile" "$work/"
cat >"$work/.env" <<EOF
OPENINVITES_IMAGE=$image
POSTGRES_PASSWORD=$(secret)
BASE_URL=http://localhost
AUTH_SECRET=$(secret)
APP_PORT=0
EOF

echo "Starting $image"
if ! compose up --detach --wait --wait-timeout 180; then
  compose ps --all
  compose logs
  exit 1
fi
compose ps

address="$(compose port app 3000)"
echo "GET http://$address/api/health"
curl --fail --silent --show-error "http://$address/api/health"
echo

uid="$(compose exec -T app id -u)"
echo "The app runs as uid $uid"
test "$uid" != 0

echo "The picture library on $(compose exec -T app uname -m):"
compose exec -T app node -e 'const { versions } = require("sharp"); console.log("sharp " + versions.sharp + ", libvips " + versions.vips)'

echo "The password reset command:"
reset="$(compose exec -T app node scripts/reset-password.mjs nobody@example.org 2>&1 || true)"
echo "$reset"
test "$reset" = "No host has the email nobody@example.org"

echo "Smoke test passed"
