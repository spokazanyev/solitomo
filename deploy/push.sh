#!/usr/bin/env bash
#
# deploy/push.sh — first-class production push to pdumarket-prod (TimeWeb VPS).
#
# Steps:
#   1. Validate local secrets file exists
#   2. scp .env → server:/home/server/apps/soliton/.env (chmod 600)
#   3. rsync source tree (web app + payload + Dockerfile + compose)
#   4. docker compose up -d --build
#   5. Wait for postgres healthcheck
#   6. (optional, with --seed flag) run seed:catalog + seed:static-pages
#   7. Smoke-test that web is responding internally
#
# Usage:
#   deploy/push.sh             # rsync + build + restart, no seed
#   deploy/push.sh --seed      # also runs catalog + static-pages seeds
#
# Exit codes:
#   0 = success
#   1 = pre-flight failure (missing secrets, ssh fail, etc)
#   2 = healthcheck timeout
#   3 = seed failure

set -euo pipefail

HOST="${PDUMARKET_HOST:-pdumarket-prod}"
APP_DIR="${PDUMARKET_APP_DIR:-/home/server/apps/soliton}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

SECRETS_FILE="$REPO_ROOT/deploy/.secrets/production-env"
SECRETS_DOC="$REPO_ROOT/deploy/.secrets/production-env.md"

RUN_SEED=0
for arg in "$@"; do
  case "$arg" in
    --seed) RUN_SEED=1 ;;
    --help|-h)
      sed -n '3,22p' "$0" | sed 's/^# //; s/^#//'
      exit 0
      ;;
    *)
      echo "Unknown arg: $arg" >&2
      exit 1
      ;;
  esac
done

# ─── 1. Validate ───────────────────────────────────────────────────
echo "[push] step 1/7 — validating secrets..."
if [[ ! -f "$SECRETS_FILE" ]]; then
  if [[ -f "$SECRETS_DOC" ]]; then
    cat <<EOM >&2
ERROR: $SECRETS_FILE not found.

Found the .md doc source at $SECRETS_DOC instead. The push script needs the
raw env file. Extract the env block (between the \`\`\`env … \`\`\` fences) and
save it as plain text at the path above.

Example:
  sed -n '/^\\\`\\\`\\\`env\$/,/^\\\`\\\`\\\`\$/p' "$SECRETS_DOC" \\
    | sed '1d;\$d' > "$SECRETS_FILE"
  chmod 600 "$SECRETS_FILE"
EOM
  else
    echo "ERROR: $SECRETS_FILE not found and no .md doc fallback either." >&2
  fi
  exit 1
fi

if ! ssh -o BatchMode=yes -o ConnectTimeout=5 "$HOST" 'echo ok' > /dev/null 2>&1; then
  echo "ERROR: cannot SSH to $HOST (key-auth, 5s timeout)" >&2
  exit 1
fi

# ─── 2. Push .env ──────────────────────────────────────────────────
echo "[push] step 2/7 — uploading .env (chmod 600)..."
scp -q "$SECRETS_FILE" "$HOST:$APP_DIR/.env"
ssh "$HOST" "chmod 600 $APP_DIR/.env"

# ─── 3. rsync source ───────────────────────────────────────────────
echo "[push] step 3/7 — rsync source tree..."
rsync -az --delete \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.git' \
  --exclude='coverage' \
  --exclude='*.log' \
  --exclude='.DS_Store' \
  --exclude='.specify' \
  --exclude='specs' \
  --exclude='07-build-specifications' \
  --exclude='.claude' \
  --exclude='deploy/.secrets' \
  "$REPO_ROOT/apps" \
  "$REPO_ROOT/00-source-data" \
  "$REPO_ROOT/package.json" \
  "$REPO_ROOT/pnpm-lock.yaml" \
  "$REPO_ROOT/pnpm-workspace.yaml" \
  "$REPO_ROOT/deploy/Dockerfile" \
  "$HOST:$APP_DIR/source/"

# Also push compose file (treated separately because it lives in APP_DIR, not source/)
scp -q "$REPO_ROOT/deploy/docker-compose.yml" "$HOST:$APP_DIR/docker-compose.yml"

# ─── 4. Build + restart ────────────────────────────────────────────
echo "[push] step 4/7 — docker compose up -d --build..."
ssh "$HOST" "cd $APP_DIR && docker compose up -d --build --remove-orphans"

# ─── 5. Wait for postgres healthcheck ──────────────────────────────
echo "[push] step 5/7 — waiting for postgres healthcheck..."
if ! ssh "$HOST" "cd $APP_DIR && timeout 120 sh -c 'until [ \"\$(docker inspect --format=\"{{.State.Health.Status}}\" soliton-postgres 2>/dev/null)\" = \"healthy\" ]; do sleep 2; done'"; then
  echo "ERROR: postgres did not reach healthy state in 120s" >&2
  ssh "$HOST" "cd $APP_DIR && docker compose logs --tail=50 soliton-postgres" >&2
  exit 2
fi

# Also wait briefly for soliton-web to be running (it doesn't have a healthcheck yet)
echo "[push] step 5b — waiting for soliton-web container..."
ssh "$HOST" "cd $APP_DIR && timeout 60 sh -c 'until docker ps --format \"{{.Names}}\" | grep -qx soliton-web; do sleep 2; done'"

# ─── 5c. Payload migrations ────────────────────────────────────────
# In NODE_ENV=production Drizzle does not auto-push schema — formal
# migrations are required. We run `payload migrate` which applies any
# pending migration in src/migrations/ to the live database. Safe to
# run on every deploy: already-applied migrations are skipped.
echo "[push] step 5c — running payload migrations..."
sleep 5
if ! ssh "$HOST" "cd $APP_DIR && docker compose exec -T soliton-web sh -c 'cd apps/web && pnpm exec payload migrate'"; then
  echo "ERROR: payload migrate failed. Inspect logs:" >&2
  ssh "$HOST" "cd $APP_DIR && docker compose logs --tail=80 soliton-web" >&2
  exit 4
fi

# ─── 6. Optional seed ──────────────────────────────────────────────
if [[ "$RUN_SEED" -eq 1 ]]; then
  echo "[push] step 6/7 — seeding catalog + static-pages..."
  # Wait a bit more for the Next.js process inside soliton-web to be ready.
  sleep 8
  if ! ssh "$HOST" "cd $APP_DIR && docker compose exec -T soliton-web pnpm --filter @soliton/web seed:catalog"; then
    echo "ERROR: seed:catalog failed (continuing — non-fatal if data already seeded)" >&2
  fi
  if ! ssh "$HOST" "cd $APP_DIR && docker compose exec -T soliton-web pnpm --filter @soliton/web seed:static-pages"; then
    echo "ERROR: seed:static-pages failed" >&2
    exit 3
  fi
else
  echo "[push] step 6/7 — skipping seed (pass --seed to enable)"
fi

# ─── 7. Smoke-test ─────────────────────────────────────────────────
echo "[push] step 7/7 — internal smoke-test..."
HTTP_CODE=$(ssh "$HOST" "docker exec soliton-web sh -c 'wget -qO- --server-response http://localhost:3000/ 2>&1 | awk \"/HTTP/ {code=\\\$2} END {print code}\"'" 2>&1 || echo "ERR")
case "$HTTP_CODE" in
  200|301|302|307|308)
    echo "[push] ✓ soliton-web responds with HTTP $HTTP_CODE"
    ;;
  *)
    echo "[push] WARN: soliton-web HTTP $HTTP_CODE (expected 2xx/3xx). Check 'docker logs soliton-web'." >&2
    ;;
esac

echo
echo "════════════════════════════════════════════════════════════════"
echo "  ✓ Deploy complete to $HOST:$APP_DIR"
echo "  • Pre-DNS-cutover: curl -skI -H 'Host: pdumarket.ru' https://45.144.220.45/"
echo "  • Post-cutover:    curl  -sI https://pdumarket.ru/"
echo "  • Logs:            ssh $HOST 'cd $APP_DIR && docker compose logs -f soliton-web'"
echo "════════════════════════════════════════════════════════════════"
