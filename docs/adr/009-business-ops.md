# ADR 009: Business operations service (inquiries, CRM, catalog, Lab Mitra)

Status: accepted. Contract: `packages/ops-contract/index.ts`. Service: `services/ops/`.

## Context

The public site sold three offers (market entry for device vendors, distribution, the Lab Mitra program for SMK) but every call to action ended in a WhatsApp chat or a downloaded brief. Nothing was recorded: no inquiry list, no follow-up owner, no record of which vendors, schools or products we work with, and no way to pay schools for verified test work. The admin backoffice only covered engineering (projects, runtime, AI keys).

The main API is deliberately owner-only and loopback-strict. The public host returns 403 for `/api/`, and that must stay true. Lead capture, however, has to accept anonymous POSTs from the internet.

## Decision

A separate small service, `iot-ai-ops` (node:sqlite, port 8791), owns business records. It follows the coordinator pattern: its own container, its own volume, its own secret.

| Route | Who | Purpose |
|---|---|---|
| `POST /ops/v1/inquiries` | Public, rate-limited | Partner form intake |
| `GET /ops/v1/catalog` | Public | Products that are published and `available` |
| `GET /ops/v1/labs` | Public | Active schools that opted into the public board |
| `/ops/v1/admin/*` | Bearer `OPS_OWNER_TOKEN` + `X-Ops-User` | Inquiries, organizations, products, tasks, payouts |

The public gateway serves only the three public routes and returns 404 for `/ops/v1/admin/`. The admin backoffice reaches admin routes through the main API (`/api/ops/*`). The API checks its session as usual, then forwards with the owner token and the HTTP Basic user from `X-Remote-User`. Without `OPS_URL` (desktop, dev, e2e) the API runs the same handler in-process against `ops.sqlite` next to its own database.

### Records

- **Inquiry**: kind (vendor, distributor, school, investor, other), contact, message, source page, status (`new → contacted → qualified → won | lost | spam`), assignee, history of notes and changes. Conversion creates an organization and marks the inquiry qualified.
- **Organization**: vendor, distributor, school or customer. Schools carry a Lab Mitra package and a `publicListing` opt-in.
- **Product**: vendor, category, wireless flag, localization checklist (SDPPI, Indonesian manual, warranty, service center, stock, pricing), evidence links and test summary. Rules: `available` requires every checklist item done or not applicable, plus evidence and a test summary; wireless products require SDPPI done; `evaluating` products cannot be published. Only published, available products appear on `/products`.
- **Task**: Lab Mitra paid test work. `open → assigned → submitted → verified | rejected → paid`. Assignment requires an active school; submission requires an evidence reference. The fee splits 60% students, 25% TEFA, 15% teacher, with rounding going to TEFA.

### Roles

`OPS_ROLES="alice:owner,bob:sales"` maps gateway users to owner, sales, ops or viewer. Sales writes inquiries and organizations, ops writes products and tasks, and viewer is read-only. Empty `OPS_ROLES` means a single owner: every authenticated gateway user is owner.

### Abuse controls

Honeypot field (`website`) returns 202 and drops the submission. The service allows 5 submissions per IP per 10 minutes and 300 per hour globally, and nginx adds `limit_req` at 6 per minute keyed on `CF-Connecting-IP`. Explicit consent is required, and bodies are capped at 20 KB in the service and 32 KB at nginx. The public proxies strip `Authorization` and `X-Ops-User`.

### Public site

- `/partner`: inquiry form with a WhatsApp fallback.
- `/products`: tested catalog, with an honest empty state.
- `/id` board: real active schools, plus open slots.

Analytics (GA4, Meta Pixel) loads only after consent, and only if `VITE_GA4_ID` / `VITE_META_PIXEL_ID` are set at build time.

## Consequences

- Leads, partners, products and payouts live in one place the team can work from, with an audit trail.
- The owner API stays closed to the public. A compromise of the public intake reaches only the ops database, not projects or AI keys.
- Notifications are an inbox in the backoffice only. Email or WhatsApp alerts need a mailbox or API account first.
- Payouts are recorded, not executed: marking a task paid is a bookkeeping step after a manual transfer.
- Multi-user roles originally depended on the gateway's HTTP Basic users; the addendum below replaces that on the admin host.

## Addendum: staff accounts replace HTTP Basic on the admin host

admin.iot.ai.id sat behind one shared nginx Basic login. It now has per-person staff accounts with the existing roles (owner, sales, ops, viewer):

- Accounts live in the ops database and reuse the school portal's auth core (`services/ops/auth.ts`, extracted from the commissions module): invite codes, scrypt passwords, lockout, hashed sessions, CSRF header. Usernames are unique across staff and school people. Accounts are disabled, never deleted, with a history; disabling ends sessions, and the last active owner cannot be disabled or demoted.
- nginx authorizes `/api/` with `auth_request` against the internal `GET /ops/v1/staff/check` (204 with `X-Staff-User` and `X-Staff-Role`, or 401). The route is not proxied publicly; the ops service is internal-only, so it accepts the call from any caller.
- An `X-Ops-User` that matches a staff account takes that account's role. Other names fall back to `OPS_ROLES`, then to single-owner, so the desktop app and dev setups are unchanged.
- The first owner is created on the server with `services/ops/cli.ts staff-invite`; the CLI refuses a second owner unless `--force` is passed. The owner then manages the team in the backoffice (`#bo-team`).
- api.iot.ai.id keeps HTTP Basic. Not done: email or SSO sign-in, password reset by email (an owner resets the invite instead) and a staff audit view beyond each account's history.

## Addendum: presentation mode on the public host

While the public site has empty pages, iot.ai.id shows them as invitation-only (see the members addendum) and a signed-in staff member can unlock them for presenting. `GET /ops/v1/staff/preview` on the admin host is a cross-origin auth oracle by design, so it is kept narrow: exact-origin CORS for https://iot.ai.id and https://www.iot.ai.id (no wildcard, credentials only for those), `Vary: Origin`, `no-store`, name and role only, no session id, no refresh beyond what `me` does, and the existing `iot_portal` rate zone. The gate is cosmetic: the page code is public JavaScript. Real protection stays where it is: `/api` needs a staff session on the admin host and is blocked on the public one.

## Addendum: member accounts and invitation-only areas

The public host no longer says "coming soon": gated areas are by invitation, and an invited client, partner or school unlocks specific areas with a member account.

- **Storage and auth.** Members live in the ops DB (kind `members`) and reuse `services/ops/auth.ts`: invite code activation (7 days, single use, lookup id plus scrypt, atomic re-validation), scrypt passwords of at least 10 characters, lockout of 5 per (person, IP) and 30 per person for 15 minutes, sha256-hashed sessions with 2 h idle, 12 h absolute and at most 5. Accounts are disabled, never deleted, with a history. The `logins` table is shared, so usernames are unique across staff, portal people and members.
- **Fields and grants.** Username, name, organization name (optionally linked to an ops organization), status and grants. Grants are a fixed set in `packages/ops-contract`: `products`, `bench`, `arena`, `builders`, `installer`. Build, Sites and Learn's start button need the owner-only cloud `/api`, so no grant opens them; members see that the workspace runs in the desktop app. Design stays staff-only.
- **Routes.** `/ops/v1/member/{activate,login,logout,me,installer}` on the public host, cookie `aiot_member` (HttpOnly, SameSite=Strict, Secure behind https, Path `/ops/v1/member`), CSRF header `X-AIoT-Member: 1` on writes, 404 on trailing slashes. `me` returns name, organization and grants only. Admin management is `/ops/v1/admin/members`, open to roles that may write organizations (owner and sales), including a one-time invite code on create and reset.
- **Isolation.** A session id is looked up in the table of the route's own kind: a member token is not a staff session (`check`, `me`, `preview`) or a portal session, and the reverse. Tested.
- **Installer.** `GET /ops/v1/member/installer` redirects to `OPS_INSTALLER_URL` for members with the `installer` grant and logs the download in their history. The release assets on GitHub stay public until moved to private storage, so this gate controls our links, not the files.
- **Consequences.** The gate is still cosmetic for page code (public JavaScript); the real protection is that `/api` stays owner-only and the installer link is only handed to members. Not done: email sign-in, password reset by email (an admin resets the invite), self-service profile edits, per-member download links or expiry, and a members audit view beyond each account's history.
