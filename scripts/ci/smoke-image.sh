#!/usr/bin/env bash
# Build deploy/Dockerfile and smoke-test ops + api inside containers (loopback, no host ports).
# Usage: scripts/ci/smoke-image.sh   (needs docker or colima running)
#        scripts/ci/smoke-image.sh --compiler   (only the compile sidecar: build, /health, auth, one AVR compile)
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
if [ "${1:-}" = "--compiler" ]; then
  # Compile sidecar: builds deploy/Dockerfile.compiler (slow cold build, the esp32 core is large), checks /health, auth and one AVR compile.
  CTAG=${SMOKE_COMPILER_TAG:-aiot-compiler:smoke}; CC=smoke-compiler-$SFX; CTOKEN=smoke-$(date +%s)-$SFX-0123456789abcdef0123456789
  trap 'docker rm -f "$CC" >/dev/null 2>&1 || true' EXIT
  [ "${SMOKE_SKIP_BUILD:-}" = 1 ] || docker build -f deploy/Dockerfile.compiler -t "$CTAG" .
  echo "image size: $(docker image inspect "$CTAG" --format '{{.Size}}' | awk '{printf "%.0f MB", $1/1048576}')"
  # Same isolation as deploy/compose.yml, minus the internal network (nothing is published to the host).
  docker run -d --name "$CC" --read-only --tmpfs /tmp:exec,size=512m,mode=1777 --cap-drop ALL --security-opt no-new-privileges:true \
    --memory 2g --cpus 1.5 --pids-limit 256 -e COMPILER_TOKEN="$CTOKEN" "$CTAG" >/dev/null
  cnode(){ docker exec "$CC" node -e "$1"; }
  h=000
  for _ in $(seq 30); do
    h=$(cnode "fetch('http://127.0.0.1:8795/health').then(r=>console.log(r.status),()=>console.log('000'))" 2>/dev/null || echo 000)
    [ "$h" = 200 ] && break; sleep 1
  done
  [ "$h" = 200 ] && echo "ok   compiler:/health -> 200" || { echo "FAIL compiler:/health -> $h"; docker logs "$CC" 2>&1 | tail -20; exit 1; }
  a=$(cnode "fetch('http://127.0.0.1:8795/compile',{method:'POST',headers:{authorization:'Bearer wrong'},body:'{}'}).then(r=>console.log(r.status))")
  [ "$a" = 401 ] && echo "ok   compiler:/compile with a wrong credential -> 401" || { echo "FAIL compiler:/compile wrong credential -> $a"; exit 1; }
  r=$(cnode "const t=Date.now();fetch('http://127.0.0.1:8795/compile',{method:'POST',headers:{authorization:'Bearer '+process.env.COMPILER_TOKEN,'content-type':'application/json'},body:JSON.stringify({target:'uno',files:[{name:'blink.ino',content:'void setup(){pinMode(13,OUTPUT);}\nvoid loop(){digitalWrite(13,HIGH);delay(500);digitalWrite(13,LOW);delay(500);}\n'}]})}).then(r=>r.json()).then(j=>console.log(j.status,j.sizes&&j.sizes.flash,(Date.now()-t)+'ms'),e=>console.log('error',e.message))")
  case "$r" in compiled*) echo "ok   compiler:avr blink -> $r";; *) echo "FAIL compiler:avr blink -> $r"; docker logs "$CC" 2>&1 | tail -20; exit 1;; esac
  echo "compiler smoke passed"; exit 0
fi
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
check ops:/ops/v1/member/catalog/search "$(status "$OPS" "http://127.0.0.1:8791/ops/v1/member/catalog/search?q=lora")" 401
check ops:/ops/v1/member/pro/quota "$(status "$OPS" http://127.0.0.1:8791/ops/v1/member/pro/quota)" 401
check api:/internal/pro/config "$(status "$API" http://127.0.0.1:8787/internal/pro/config)" 503 # disabled without OPS_API_INTERNAL_TOKEN
check api:/api/session "$(status "$API" http://127.0.0.1:8787/api/session)" 200
[ $fail = 0 ] || { docker logs "$OPS" 2>&1 | tail -20; docker logs "$API" 2>&1 | tail -20; exit 1; }
echo "smoke passed"
