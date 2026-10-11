# Public website and protected owner workspace

The main website serves landing pages, documentation, downloads and static assets without a login. Interactive cloud workspaces remain owner-only; public multi-tenant accounts are not implemented. The HTTPS gateway requires HTTP Basic authentication for the admin website and API subdomain. The coordinator uses its own bearer scopes. Database contents are shared by the test owner; do not invite unrelated users until project ownership and production account authorization exist.

| Host | Purpose | Authentication |
|---|---|---|
| iot.ai.id | Public landing, documentation, downloads and static pages | None; /api/* returns JSON 403 without a login challenge |
| admin.iot.ai.id | Backoffice at / (old /backoffice links redirect) | Testing workspace login |
| api.iot.ai.id | Local API proxy at /api/* | Testing workspace login plus X-IOT-Session |
| edge.iot.ai.id | Coordinator at /v1/* | Scoped node/owner bearer token |
| iot.ai.id/ops/v1/ | Partner inquiries (POST), tested catalog and Lab Mitra board (GET) | None; rate-limited; /ops/v1/admin/ returns 404 |

The main website does not proxy the shared owner API. Build, hardware and other API-dependent pages show an unavailable-workspace message when requesting data; use the desktop app or an authorized admin workspace for interactive work. The `/api` page remains public API documentation; `/api/` requests are blocked.

The API remains strict about loopback Host and Origin. The authenticated admin and API gateways check incoming browser Origins before rewriting upstream Host and Origin. They never expose /api/session anonymously. The API service publishes no host ports. HTTPS terminates in the existing nginx gateway; each of the four names is explicitly covered by the origin certificate.

## Files on the server

- /opt/iot-ai-id/current: deployment source.
- /opt/iot-ai-id/secrets/provider.env: optional bootstrap provider environment, mode 600.
- /opt/iot-ai-id/secrets/knowledge.json: internal OpenViking server configuration and root management key, mode 600.
- /opt/iot-ai-id/secrets/knowledge.env: tenant-bound OpenViking data key for API service, mode 600.
- /opt/iot-ai-id/secrets/access.txt: generated testing workspace login, mode 600.
- /opt/iot-ai-id/secrets/coordinator.env: generated owner and node scopes, mode 600.
- /opt/iot-ai-id/releases/nginx-before.conf: previous iot nginx configuration for rollback.
- /opt/iot-ai-id/secrets/ops.env: `OPS_OWNER_TOKEN` shared by the API and ops service, and `OPS_ROLES`, mode 600. Created on first ops deploy.
- Docker volumes: iot-ai-release_iot_data, iot-ai-release_coordinator_data and iot-ai-release_ops_data.

## AI settings

The cloud runs only on AIoT's own owner keys. Open `/backoffice#bo-ai` on the admin host and save keys for OpenAI, Anthropic, MiniMax or Z.ai GLM (and optionally TypeSafe/Jev), pick the active provider and model, and use each connection test. The form clears the submitted key; later reads return only a fingerprint and test metadata. End-user keys are never stored in the cloud: bring-your-own-key, OpenAI-compatible endpoints and the Codex/Claude Code CLI providers exist only in the desktop app, where keys stay on the user's computer. The API refuses those providers when `IOT_DEPLOYMENT=cloud`.

Keys are encrypted with AES-256-GCM in `/data/secrets/credentials.json`. The master key lives outside the data volume: create a 32-byte file at `/opt/iot-ai-id/secrets/vault.key` (mode 600, for example `head -c 32 /dev/urandom > vault.key`), which compose mounts read-only at `/run/secrets/vault.key` through `IOT_VAULT_KEY_FILE`. The API never creates this file and refuses to start if it is missing or not 32 bytes. If an old `master.key` still sits in the data volume, the API deletes it at startup when it matches the key file, and refuses to start (`Vault key mismatch`) when it differs, so volume backups no longer hold the key next to the ciphertext. Back up `vault.key` separately; losing it makes saved keys unreadable.

Every save, delete, test and preference change is appended to `/data/secrets/ai-audit.jsonl` (time, action, provider, gateway user from `X-Remote-User`, key fingerprint; never the key). Non-secret choices (active provider, models) are in `ai-preferences.json`. Cloud AI calls are capped per UTC day by `IOT_AI_DAILY_LIMIT` (default 300); past the cap AI requests fail with HTTP 429 `Daily AI limit reached`.

Saved keys take precedence for new AI operations without restarting the server. Selection order is the chosen active provider, then the first configured of OpenAI, Anthropic, MiniMax, Z.ai. Running operations retain their credential snapshot until completion. TypeSafe/Jev routing is optional and is skipped when unavailable.

Bootstrap environment is optional. Never commit secrets, mount a user's home directory, or copy desktop credentials into an image. No secrets are required in the renderer or browser storage. Sign in with ChatGPT is not implemented in this preview.

The bundled Jev decision scripts use TypeSafe when present; the frontier provider is whichever AI provider is active (OpenAI Responses, or an Anthropic-compatible API). Missing or rejected credentials produce an explicit unavailable-provider error, never a fixture fallback. OpenViking runs as a separate internal service with local CPU embeddings and vectors-only ingestion. VLM is unconfigured, so semantic generation is unavailable. Network authentication uses a dedicated tenant-bound data key; the root key is reserved for account provisioning. Its knowledge network publishes no host port. Deployment verification indexed all 56 catalog records and returned live ESP32/BME280 search results. Catalog specifications and validation remain deterministic.

## Business operations

The ops service (ADR 009) keeps inquiries, organizations, products and Lab Mitra tasks in its own volume. Work them in the backoffice at `#bo-inquiries`, `#bo-orgs`, `#bo-products` and `#bo-tasks`; the API forwards these requests to `iot-ai-ops:8791` with the owner token and the gateway login as `X-Remote-User`.

Roles follow the HTTP Basic login. To add a teammate, add their user to the gateway htpasswd file for the admin and API hosts. Then set `OPS_ROLES=owner-user:owner,sales-user:sales,ops-user:ops,viewer-user:viewer` in `ops.env` and restart `api` and `ops`. Users not listed get 403 on business panels; an empty `OPS_ROLES` makes every gateway user owner.

Conversion tracking stays off until `VITE_GA4_ID` or `VITE_META_PIXEL_ID` is set for the web build; visitors must accept the consent banner before any tag loads.

## Edge scopes and USB

The initial test-laptop node has an empty project allowlist. Before enabling it, add only the required local project UUIDs to its server configuration and the matching local node environment. Start the local API/desktop and outbound node with explicit synchronization authorization. The cloud cannot access laptop USB. Flashing remains authorized on the local machine for a detected port, with an expiring approval window. A cloud project is not automatically synchronized into desktop storage in this release.

## Verification and rollback

Check anonymous main-site landing, documentation, downloads and assets return 200 without `WWW-Authenticate`. Main-site /api/session, /api/projects and /api/ai-settings must return JSON 403 without `WWW-Authenticate` or owner data. Anonymous admin and API subdomain requests must return 401 with the owner login challenge. Check API-dependent public pages show a clear message without a password popup, hostile Origin returns 403, coordinator /v1/jobs without a bearer token returns 403, `/ops/v1/catalog` returns 200, an invalid inquiry returns 400, public `/ops/v1/admin/*` returns 404, and existing applications remain healthy. Inspect provider readiness and a fresh planning request before claiming live AI. Software simulation never establishes physical hardware verification.

For rollback, restore nginx-before.conf to the iot vhost, run nginx -t, then reload the gateway. Preserve the data volumes. Do not run compose down -v. Certificate renewal runs twice daily through `/etc/cron.d/iot-ai-id-cert`, using the existing certbot container and a project-specific lock. `deploy/renew-certificate.sh` renews only this project certificate, validates nginx and reloads the gateway.
