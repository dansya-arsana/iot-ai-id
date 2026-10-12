# Public website and protected owner workspace

The main website serves landing pages, documentation, downloads and static assets without a login. Interactive cloud workspaces remain owner-only; public multi-tenant accounts are not implemented. The admin website uses per-person staff logins; the API subdomain still requires HTTP Basic authentication. The coordinator uses its own bearer scopes. Database contents are shared by the test owner; do not invite unrelated users until project ownership and production account authorization exist.

| Host | Purpose | Authentication |
|---|---|---|
| iot.ai.id | Public landing, documentation, downloads and static pages | None; /api/* returns JSON 403 without a login challenge |
| admin.iot.ai.id | Landing and sign-in at /, backoffice after sign-in (old /backoffice links redirect) | Per-person staff login (cookie `aiot_admin`); no HTTP Basic |
| api.iot.ai.id | Local API proxy at /api/* | HTTP Basic (testing workspace login) plus X-IOT-Session; unchanged |
| edge.iot.ai.id | Coordinator at /v1/* | Scoped node/owner bearer token |
| iot.ai.id/ops/v1/ | Partner inquiries (POST), tested catalog and Lab Mitra board (GET) | None; rate-limited; /ops/v1/admin/ returns 404 |
| admin.iot.ai.id/ops/v1/staff/ | Staff login, activation, logout and session (`/check` is internal only) | Invite code, password and the `aiot_admin` cookie; `X-AIoT-Staff: 1` on writes; zone `iot_staff_auth` (5 r/m) on login and activate. The main host returns 404 for `/ops/v1/staff/` |
| admin.iot.ai.id/ops/v1/staff/preview | `GET`, presentation mode: 200 `{name, role}` for a live staff session, 401 otherwise. Answers cross-origin only to https://iot.ai.id and https://www.iot.ai.id | `aiot_admin` cookie (sent because the sites are same-site); same `iot_portal` zone as the other staff routes |
| iot.ai.id/ops/v1/portal/ | Lab Mitra school portal API (all methods) used by `/mitra` | Invite code, password and the `aiot_portal` cookie; `X-AIoT-Portal: 1` on writes; nginx zones `iot_portal` (60 r/m, burst 30) and `iot_portal_auth` (5 r/m on login and activate) |
| iot.ai.id/ops/v1/member/ | Member accounts: `activate`, `login`, `logout`, `me` (name, organization, grants) and `installer` (302 to `OPS_INSTALLER_URL`) | Invite code, password and the `aiot_member` cookie (Path `/ops/v1/member`, HttpOnly, SameSite=Strict, Secure behind https); `X-AIoT-Member: 1` on writes; nginx zones `iot_portal` (60 r/m, burst 30) and `iot_portal_auth` (5 r/m, burst 3) on login and activate. The admin host does not serve it |

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
- /opt/iot-ai-id/secrets/ops.env: `OPS_OWNER_TOKEN` shared by the API and ops service, `OPS_ROLES`, and optionally `OPS_INSTALLER_URL` (https only; until it is set `/ops/v1/member/installer` answers 503), mode 600. Recreate the ops container after changing it. Created on first ops deploy.
- Docker volumes: iot-ai-release_iot_data, iot-ai-release_coordinator_data and iot-ai-release_ops_data.

## AI settings

The cloud runs only on AIoT's own owner keys. Open `/backoffice#bo-ai` on the admin host and save keys for OpenAI, Anthropic, MiniMax or Z.ai GLM (and optionally TypeSafe/Jev), pick the active provider and model, and use each connection test. The form clears the submitted key; later reads return only a fingerprint and test metadata. End-user keys are never stored in the cloud: bring-your-own-key, OpenAI-compatible endpoints and the Codex/Claude Code CLI providers exist only in the desktop app, where keys stay on the user's computer. The API refuses those providers when `IOT_DEPLOYMENT=cloud`.

Keys are encrypted with AES-256-GCM in `/data/secrets/credentials.json`. The master key lives outside the data volume: create a 32-byte file at `/opt/iot-ai-id/secrets/vault.key` (mode 600, for example `head -c 32 /dev/urandom > vault.key`), which compose mounts read-only at `/run/secrets/vault.key` through `IOT_VAULT_KEY_FILE`. The API never creates this file and refuses to start if it is missing or not 32 bytes. If an old `master.key` still sits in the data volume, the API deletes it at startup when it matches the key file, and refuses to start (`Vault key mismatch`) when it differs, so volume backups no longer hold the key next to the ciphertext. Back up `vault.key` separately; losing it makes saved keys unreadable.

Every save, delete, test and preference change is appended to `/data/secrets/ai-audit.jsonl` (time, action, provider, gateway user from `X-Remote-User`, key fingerprint; never the key). Non-secret choices (active provider, models) are in `ai-preferences.json`. Cloud AI calls are capped per UTC day by `IOT_AI_DAILY_LIMIT` (default 300); past the cap AI requests fail with HTTP 429 `Daily AI limit reached`.

Saved keys take precedence for new AI operations without restarting the server. Selection order is the chosen active provider, then the first configured of OpenAI, Anthropic, MiniMax, Z.ai. Running operations retain their credential snapshot until completion. TypeSafe/Jev routing is optional and is skipped when unavailable.

Bootstrap environment is optional. Never commit secrets, mount a user's home directory, or copy desktop credentials into an image. No secrets are required in the renderer or browser storage. Sign in with ChatGPT is not implemented in this preview.

The bundled Jev decision scripts use TypeSafe when present; the frontier provider is whichever AI provider is active (OpenAI Responses, or an Anthropic-compatible API). Missing or rejected credentials produce an explicit unavailable-provider error, never a fixture fallback. OpenViking runs as a separate internal service with local CPU embeddings and vectors-only ingestion. VLM is unconfigured, so semantic generation is unavailable. Network authentication uses a dedicated tenant-bound data key; the root key is reserved for account provisioning. Its knowledge network publishes no host port. Deployment verification indexed all 56 catalog records and returned live ESP32/BME280 search results. Catalog specifications and validation remain deterministic.

## Business operations

`X-Real-IP` is trusted only because the ops service listens on the internal docker network or loopback behind nginx: never publish `OPS_HOST` or the ops port, or callers could forge the header and dodge the per-IP limits.

The school portal (ADR 010) is served by the same ops service under `/ops/v1/portal/*` on the public host. nginx proxies every method there, strips `Authorization` and `X-Ops-User`, sets `X-Real-IP` from `CF-Connecting-IP` and `X-Forwarded-Proto` from the scheme (the service sets the cookie `Secure` flag from it), caps bodies at 32 KB and applies the `iot_portal` and `iot_portal_auth` rate zones. These blocks and the two `limit_req_zone` lines are live in production since 2026-10-11. Commissions, payout batches and school admin invites are worked in the backoffice at `#bo-commissions`. The ledger lives in the same `ops.sqlite` volume, so back that volume up.

The ops service (ADR 009) keeps inquiries, organizations, products and Lab Mitra tasks in its own volume. Work them in the backoffice at `#bo-inquiries`, `#bo-orgs`, `#bo-products` and `#bo-tasks`; the API forwards these requests to `iot-ai-ops:8791` with the owner token and the gateway login as `X-Remote-User`.

## Staff login on the admin host (ADR 009 addendum)

admin.iot.ai.id no longer uses HTTP Basic. The page at `/` is a landing with Sign in and Activate invite. Staff accounts (username, name, role owner, sales, ops or viewer) live in the ops database and reuse the school portal's login core: 7-day single-use invite codes, scrypt passwords of at least 10 characters, lockout after 5 failures per person and IP (30 per person) for 15 minutes, sessions with a 2 h idle and 12 h absolute limit (max 5), and the `aiot_admin` cookie (HttpOnly, SameSite=Strict, Secure behind nginx, Path=/). Writes need the `X-AIoT-Staff: 1` header.

How a request is authorized: nginx runs `auth_request /_staff_check` for every `/api/` call. That internal location calls the ops service at `/ops/v1/staff/check`, which answers 204 with `X-Staff-User` and `X-Staff-Role` for a live session (refreshing its idle time) or 401. nginx passes the username on as `X-Remote-User`, and the role comes from the staff account. `/ops/v1/staff/check` is internal only: the admin host returns 404 for it, and the ops service itself is never published. The public auth routes are `/ops/v1/staff/login`, `activate`, `logout` and `me`; `login` and `activate` use the `iot_staff_auth` zone (5 per minute, burst 3), the rest `iot_portal`. These blocks and the new zone are live in production since 2026-10-11 (release f85eff5); the main host also answers 404 for `/ops/v1/staff/`.

Bootstrap the first owner once, on the server, against the ops database (the CLI prints only the code and its expiry):

```
docker compose -f compose.yml exec -T ops node --import tsx services/ops/cli.ts staff-invite <username> owner "Full Name"
```

Run it with `OPS_DB` pointing at the same file the ops service uses (it is already set in the container). Open admin.iot.ai.id, choose Activate invite and set a password. The CLI refuses to create a second owner while an active owner exists unless `--force` is passed; re-running it for an existing person only issues a new invite. After that, the owner manages everyone in the backoffice under `#bo-team`: add a person (the code is shown once), change a role, disable (ends their sessions) or reset an invite. Accounts are never deleted, and the last active owner cannot be disabled or demoted.

Role resolution: an `X-Ops-User` that matches a staff account uses that account's role (a disabled account gets none). Other users fall back to `OPS_ROLES`, and with no `OPS_ROLES` an install is single-owner, which keeps the desktop app and local dev unchanged. Local hosts keep `/backoffice` with no staff login. api.iot.ai.id still uses HTTP Basic.

Conversion tracking stays off until `VITE_GA4_ID` or `VITE_META_PIXEL_ID` is set for the web build; visitors must accept the consent banner before any tag loads.

## Edge scopes and USB

The initial test-laptop node has an empty project allowlist. Before enabling it, add only the required local project UUIDs to its server configuration and the matching local node environment. Start the local API/desktop and outbound node with explicit synchronization authorization. The cloud cannot access laptop USB. Flashing remains authorized on the local machine for a detected port, with an expiring approval window. A cloud project is not automatically synchronized into desktop storage in this release.

## Verification and rollback

Check anonymous main-site landing, documentation, downloads and assets return 200 without `WWW-Authenticate`. Main-site /api/session, /api/projects and /api/ai-settings must return JSON 403 without `WWW-Authenticate` or owner data. The admin root must return 200 (landing page) while anonymous admin `/api/*` returns 401 without a login challenge, `/ops/v1/staff/me` returns 401 and `/ops/v1/staff/check` returns 404 on both hosts. Anonymous API subdomain requests must return 401 with the owner login challenge. Check API-dependent public pages show a clear message without a password popup, hostile Origin returns 403, coordinator /v1/jobs without a bearer token returns 403, `/ops/v1/catalog` returns 200, an invalid inquiry returns 400, public `/ops/v1/admin/*` returns 404, and existing applications remain healthy. Inspect provider readiness and a fresh planning request before claiming live AI. Software simulation never establishes physical hardware verification.

For rollback, restore nginx-before.conf to the iot vhost, run nginx -t, then reload the gateway. Preserve the data volumes. Do not run compose down -v. Certificate renewal runs twice daily through `/etc/cron.d/iot-ai-id-cert`, using the existing certbot container and a project-specific lock. `deploy/renew-certificate.sh` renews only this project certificate, validates nginx and reloads the gateway.

## Invitation-only areas, members and presentation mode on iot.ai.id

Gated pages (Products, Builders, PhysicalBench, Arena, Build, Sites, Design, the `/id` leaderboard and the Learn start button) show "By invitation" to anonymous visitors (`apps/web/src/preview.tsx`; the host check is `isPublicHost()` in `apps/web/src/host.ts`, and nothing else is configured). A header "Sign in" link leads to `/masuk` (alias `/login`); a signed-in member sees their name linking to `/profile` (alias `/profil`). Both pages are noindex and out of the sitemap. Nav links to a gated area appear only for visitors who can open it.

Who unlocks what on the public host:
- A **member** unlocks the areas their grants name: `products`, `bench`, `arena`, `builders`. The `installer` grant adds the download button to the profile and nothing else. Build, Sites and Learn's start button need `/api`, which the cloud keeps owner-only, so for a member they say the workspace runs in the desktop app (with the installer button when granted). Design stays staff-only.
- A **staff member** with a live session on admin.iot.ai.id unlocks everything (presentation mode, below).
- Member state is kept in memory only (nothing in localStorage). Sign-in sets a readable hint cookie `aiot_member_hint=1` (Path `/`, SameSite=Strict, Secure behind https, not HttpOnly, 12 h); sign-out clears it, and a 401 from `me` clears a stale one. The page calls `GET /ops/v1/member/me` once, and only when the hint is present, so anonymous visitors (and schools behind one NAT address) cost no requests against the per-IP `iot_portal` zone. The hint is never proof of access. A 429, 5xx or network error is "unknown" rather than "anonymous": the probe retries twice with backoff before falling back. No extra nginx zone is needed.

Members are managed in the backoffice at `#bo-members` (owner and sales): add a member with grant checkboxes (the invite code is shown once and expires in 7 days), edit grants, disable or enable (enabling a member who never activated issues a fresh invite, shown once, because disabling voided the old one), reset the invite, read the history (including each installer download). Admin routes are `/ops/v1/admin/members[/:id[/invite]]` through the API's `/api/ops/*` proxy. Sessions use the same rules as staff and the portal: 2 h idle, 12 h absolute, at most 5, scrypt passwords of 10 or more characters, lockout after 5 failures per (person, IP) and 30 per person for 15 minutes. Usernames are unique across staff, portal people and members.

`GET /ops/v1/member/installer` is a top-level navigation: 302 to `OPS_INSTALLER_URL` for a member with the `installer` grant, 403 without it, 401 without a session, 503 while the variable is unset or not an https URL. Set it in the ops env file (generically `/opt/iot-ai-id/secrets/ops.env`, which the ops container loads), for example `OPS_INSTALLER_URL=https://downloads.example.com/aiot-desktop.zip`. Honest limit: the GitHub release assets remain public until they are moved to private storage. This gate only controls the links on our site; anyone who knows the release URL can still download.

nginx (public server block, before the generic `/ops/v1/` GET passthrough): `location = /ops/v1/member/login` and `= /ops/v1/member/activate` use zone `iot_portal_auth burst=3 nodelay`, `location /ops/v1/member/` uses `iot_portal burst=30 nodelay`; all three return 429 on limit, cap bodies at 32k, set `Host`, `X-Real-IP $iot_client_ip` and `X-Forwarded-Proto $scheme`, and blank `Authorization` and `X-Ops-User`. The e2e alias `iot.admin.localhost` serves `/ops/v1/member/*` in-process from the local API and nothing else under `/ops/`.

### Presentation mode

iot.ai.id probes `https://admin.iot.ai.id/ops/v1/staff/preview` with credentials. The `aiot_admin` cookie is Strict but iot.ai.id and admin.iot.ai.id are same-site, so a live staff session answers 200 and unlocks the pages (in memory only, per page load). The route is a simple GET: no preflight. The ops service returns `Access-Control-Allow-Origin` and `Access-Control-Allow-Credentials: true` only when `Origin` is exactly https://iot.ai.id or https://www.iot.ai.id (the e2e alias counts only for plain loopback requests); `Vary: Origin` and `Cache-Control: no-store` always; no CORS headers for any other origin. It reads the session like `me` and reveals only name and role. A member session never satisfies it, and a staff session never satisfies the member routes (separate tables, resolved by kind). No nginx change is needed: the admin host already proxies `/ops/v1/staff/` (zone `iot_portal`), and the main host keeps answering 404 for it. The nginx origin map allows https://iot.ai.id but not www, and www is not served, so the www entry is inert. Build and Sites need `/api`, which the public host blocks, so in preview they link to the same path on admin.iot.ai.id. Gated routes are noindex, absent from the sitemap and llms.txt, and prerendered as a short invitation-only shell. To re-open a page for everyone, remove it from `GATES` in `apps/web/src/preview.tsx` and from the list in `scripts/build-seo.ts`.
