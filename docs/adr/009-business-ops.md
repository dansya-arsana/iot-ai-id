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
- Multi-user roles depend on the gateway's HTTP Basic users. Per-user accounts with their own passwords remain future work.
