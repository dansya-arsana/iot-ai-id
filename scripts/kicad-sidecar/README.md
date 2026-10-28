# KiCad sidecar

Runs `kicad-cli` (ERC, DRC, gerber/drill) behind a tiny HTTP server. Optional Freerouting runs as a separate java process (GPL-3, never linked).

Build: `docker build -f scripts/kicad-sidecar/Dockerfile.kicad -t aiot-kicad scripts/kicad-sidecar`

The owner must add this to `deploy/compose.yml` (the agent did not edit it):

```yaml
  kicad:
    build: { context: ../scripts/kicad-sidecar, dockerfile: Dockerfile.kicad }
    environment: [SIDECAR_TOKEN=${KICAD_SIDECAR_TOKEN}]
    # internal network only, no published port
```

On the ops service set `KICAD_SIDECAR_URL=http://kicad:8787` and `KICAD_SIDECAR_TOKEN` (same value).
Without `KICAD_SIDECAR_URL`, `services/ops/kicad-check.ts` returns `{status:'pending'}`.

API: `POST /check?gerber=1&route=1`, body = project zip, header `X-Sidecar-Token`. Returns `{erc,drc,gerberZipBase64?,routed?}` (KiCad JSON reports). `GET /health`.
Freerouting: mount the jar, set `ENABLE_FREEROUTING=1` and `FREEROUTING_JAR=/path.jar`.
Unrouted connections from DRC are reported as information, not errors.
