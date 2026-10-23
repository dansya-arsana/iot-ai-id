#!/usr/bin/env bash
# Build deploy/Dockerfile and smoke-test ops + api inside containers (loopback, no host ports).
# Usage: scripts/ci/smoke-image.sh   (needs docker or colima running)
# Env: SMOKE_IMAGE_TAG, SMOKE_SKIP_BUILD=1, EXPECT_CATALOG=200, EXPECT_EXAMPLES=401 (member auth required)
set -euo pipefail
cd "$(dirname "$0")/../.."
TAG=${SMOKE_IMAGE_TAG:-iot-ai-smoke:local}
EXPECT_CATALOG=${EXPECT_CATALOG:-200}
EXPECT_EXAMPLES=${EXPECT_EXAMPLES:-401}
SFX=$$
OPS=smoke-ops-$SFX; API=smoke-api-$SFX
cleanup(){ docker rm -f "$OPS" "$API" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker info >/dev/null 2>&1 || { echo "docker not running (try: colima start)"; exit 2; }
[ "${SMOKE_SKIP_BUILD:-}" = 1 ] || docker build -f deploy/Dockerfile -t "$TAG" .
docker run -d --name "$OPS" -e OPS_DB=/tmp/ops.sqlite -e OPS_HOST=127.0.0.1 -e OPS_PORT=8791 "$TAG" node --import tsx services/ops/server.ts >/dev/null
docker run -d --name "$API" -e IOT_DEPLOYMENT=cloud -e IOT_DB_PATH=/tmp/iot.sqlite -e API_PORT=8787 -e API_BIND=127.0.0.1 -e OPENVIKING_URL=http://127.0.0.1:1 "$TAG" >/dev/null
status(){ # container port path -> http status or 000, retrying up to 30s
  local c=$1 url=$2 out=000
  for _ in $(seq 30); do
    out=$(docker exec "$c" node -e "fetch(process.argv[1]).then(r=>console.log(r.status),()=>console.log('000'))" "$url" 2>/dev/null || echo 000)
    [ "$out" != 000 ] && break; sleep 1
  done; echo "$out"
}
fail=0
check(){ # name got want
  if [ "$2" = "$3" ]; then echo "ok   $1 -> $2"; else echo "FAIL $1 -> $2 (want $3)"; fail=1; fi; }
check ops:/ops/v1/catalog "$(status "$OPS" http://127.0.0.1:8791/ops/v1/catalog)" "$EXPECT_CATALOG"
check ops:/ops/v1/member/lab/examples "$(status "$OPS" http://127.0.0.1:8791/ops/v1/member/lab/examples)" "$EXPECT_EXAMPLES"
check api:/api/session "$(status "$API" http://127.0.0.1:8787/api/session)" 200
[ $fail = 0 ] || { docker logs "$OPS" 2>&1 | tail -20; docker logs "$API" 2>&1 | tail -20; exit 1; }
echo "smoke passed"
