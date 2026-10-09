# Public website and protected owner workspace

The main website serves landing pages, documentation, downloads and static assets without a login. Interactive cloud workspaces remain owner-only; public multi-tenant accounts are not implemented. The HTTPS gateway requires HTTP Basic authentication for the admin website and API subdomain. The coordinator uses its own bearer scopes. Database contents are shared by the test owner; do not invite unrelated users until project ownership and production account authorization exist.

| Host | Purpose | Authentication |
|---|---|---|
| iot.ai.id | Public landing, documentation, downloads and static pages | None; /api/* returns JSON 403 without a login challenge |
| admin.iot.ai.id | Backoffice entry at /backoffice | Testing workspace login |
| api.iot.ai.id | Local API proxy at /api/* | Testing workspace login plus X-IOT-Session |
| edge.iot.ai.id | Coordinator at /v1/* | Scoped node/owner bearer token |

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
- Docker volumes: iot-ai-release_iot_data and iot-ai-release_coordinator_data.

## AI settings

Open `/backoffice#bo-ai` on the admin host. Save the OpenAI API key and TypeSafe/Jev key in the owner settings, then use each connection test. The form clears the submitted key; later reads return only a fingerprint and test metadata. OpenAI connection testing verifies authentication, not entitlement to GPT-6.1 Sol inference. Keys are encrypted with AES-256-GCM in `/data/secrets/credentials.json`; the separate mode-600 master key is `/data/secrets/master.key`. Both remain in the private API data volume and are excluded from project exports and installers. Preserve the master key when backing up the vault; losing it makes saved keys unreadable.

Saved keys take precedence for new AI operations without restarting the server. Deletion removes the saved key; an optional bootstrap environment or authenticated local Codex may still apply. Running operations retain their credential snapshot until completion. This shared owner workspace does not provide isolated cloud BYOK accounts. Desktop instances use their own local workspace vault. Per-user cloud BYOK requires application accounts and project ownership before accepting unrelated users.

Bootstrap environment is optional. Never commit secrets, mount a user's home directory, or copy desktop credentials into an image. No secrets are required in the renderer or browser storage. Sign in with ChatGPT is not implemented in this preview.

The bundled Jev decision scripts use TypeSafe; the frontier provider uses OpenAI Responses. Missing or rejected credentials produce an explicit unavailable-provider error, never a fixture fallback. OpenViking runs as a separate internal service with local CPU embeddings and vectors-only ingestion. VLM is unconfigured, so semantic generation is unavailable. Network authentication uses a dedicated tenant-bound data key; the root key is reserved for account provisioning. Its knowledge network publishes no host port. Deployment verification indexed all 56 catalog records and returned live ESP32/BME280 search results. Catalog specifications and validation remain deterministic.

## Edge scopes and USB

The initial test-laptop node has an empty project allowlist. Before enabling it, add only the required local project UUIDs to its server configuration and the matching local node environment. Start the local API/desktop and outbound node with explicit synchronization authorization. The cloud cannot access laptop USB. Flashing remains authorized on the local machine for a detected port, with an expiring approval window. A cloud project is not automatically synchronized into desktop storage in this release.

## Verification and rollback

Check anonymous main-site landing, documentation, downloads and assets return 200 without `WWW-Authenticate`. Main-site /api/session, /api/projects and /api/ai-settings must return JSON 403 without `WWW-Authenticate` or owner data. Anonymous admin and API subdomain requests must return 401 with the owner login challenge. Check API-dependent public pages show a clear message without a password popup, hostile Origin returns 403, coordinator /v1/jobs without a bearer token returns 403, and existing applications remain healthy. Inspect provider readiness and a fresh planning request before claiming live AI. Software simulation never establishes physical hardware verification.

For rollback, restore nginx-before.conf to the iot vhost, run nginx -t, then reload the gateway. Preserve the data volumes. Do not run compose down -v. Certificate renewal runs twice daily through `/etc/cron.d/iot-ai-id-cert`, using the existing certbot container and a project-specific lock. `deploy/renew-certificate.sh` renews only this project certificate, validates nginx and reloads the gateway.
