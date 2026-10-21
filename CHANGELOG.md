# Changelog

All notable changes to iot.ai.id. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [Semantic Versioning](https://semver.org/) (pre-1.0: minor = feature release, patch = fixes only).

Each release is a local annotated git tag (`v0.x.y`). Draft the next entry with `npm run release:notes`, which groups commits since the last tag.

## [Unreleased]

### Added
- Public Arduino lab (`/lab`, `/lab/:lesson`): 12 guided lessons on an emulated Arduino UNO. Precompiled ATmega328P firmware runs in avr8js in the browser, in a lazy-loaded chunk with a three.js board scene. Free, no sign-in.
  - "Bench Record" design in the AIoT system (Archivo, IBM Plex Mono, warm-grey bench, one live-green accent). It shows what really runs: a logic analyzer drawn from the emulated chip's pin history (HIGH/LOW, PWM duty and frequency, analog input, TX), a port map, a live cycle counter and speed, callouts with measured values (LED current, ADC reading, PWM), goals checked from chip data ("D8 toggled 4× · high 500.1 ms"), firmware size, and 3D lesson thumbnails.
  - Inspector values are patched into the real firmware bytes (verified against a recompile), line highlighting comes from DWARF line tables, and each lesson has a real success check.
  - The code view is read-only. Only the declared parameters and the pre-compiled variants can change; there is no in-browser compiler.
  - Firmware is built offline with `npm run lab:firmware` (arduino-cli, Docker fallback); see docs/lab-firmware.md. Images include ArduinoCore-avr and Servo (LGPL-2.1), noted in THIRD_PARTY_NOTICES.md.
  - Lab link in the main nav and footer, a public card on Learn, and prerendered SEO pages for each lesson.
- Lab v3 direct manipulation: drag the obstacle (snaps to whole cm, Shift for 5 cm) and the lamp in the 3D scene, turn the knob by dragging the 3D knob (relative, no jump), press the button in 3D, hover cursors and rims, keyboard access. Clicking a part with settings opens a popover: obstacle type (car, box, ball, wall), distance, "drive back and forth while running" and "Zoom to it"; the servo and motor have a load slider that slows the horn and the shaft.
- Lab AI builder ("+ Build with AI" in the lesson strip): describe a circuit, the AI designs the CircuitSpec and the sketch, the 3D scene plays a captioned step-by-step assembly (board drops in, breadboard, each part placed, each wire drawn), then it runs for real on the emulated chip with the generated, compiled firmware. Three curated examples (Parking beeper, Night light, Servo gate) run instantly for everyone. Free typing needs the new `lab-ai` member grant (20 builds a day per member, global daily cap). Keys stay in the owner-only api; ops reaches it over the internal network with `OPS_API_INTERNAL_TOKEN`, and sketches compile in a no-network sandbox container. See docs/adr/011-lab-ai-builder.md.
- UNO model polish: second ICSP, 16U2 and regulator legs, M7 diode, SMD crystal, "UNO R3-compatible" silkscreen.
- Lab v4 plugin API: a component is a `PartModule` plus a `DeviceDef` (`sim/devices/<kind>.ts`) discovered automatically, with shared open-drain lines, a lazy I2C bus and a UART tap. All existing parts were ported. `npm run lab:new-part` scaffolds a new one. See docs/lab-extending.md and docs/lab-parts/.
- Lesson 12, DHT22 temperature and humidity: real one-wire timing (18 ms start pulse, 80/80 us answer, 40 bits, checksum), sliders in the sensor popover, serial prints the readings.
- Real board panel in the lab (desktop app / 127.0.0.1 only): detect a UNO, authorize the port (20 minutes), upload the exact simulator firmware bytes through arduino-cli, read its serial and compare with the simulator ("behaves the same" or "differs, check wiring on D8"). New routes `/api/lab/hardware/*` sit behind the loopback and session checks and refuse upload and serial without trust. The public site shows a note pointing to the desktop app. See docs/lab-hardware.md.

### Fixed
- Lab callout pills are measured in layout pixels, so they no longer cover the power jack below 1440 px; the test record wraps instead of clipping on narrow or short screens; framing of lessons 7 and 11 improved.
- Lab pin duty is smoothed over time so very short simulation slices do not alias a 490 Hz PWM; LED full brightness is reached at 12 mA.

## [0.7.0] - 2026-10-14

### Added
- Global home hero (`/`, English): a full-screen interactive Indonesia test map, "Prove your robot where it actually breaks."
  - Nine areas (Java, Batam & Riau Islands, Sumatra, Kalimantan, Sulawesi, Bali & Nusa Tenggara, Maluku, Papua and the clickable Maritime Indonesia), each with an identity line, at most three H/M-confidence facts with a superscript source and year, test scenarios and a "Get a test plan" CTA that prefills `/partner`.
  - Lenses that combine (AND): I build, Stressor, Month (coarse BMKG regimes, labelled as a typical pattern), Access (planned labs, free trade zone, KEK zones) and School reach (existing SMK counts from Data Referensi Kemendikdasmen, framed as potential Lab Mitra reach, not partners). Clear resets them.
  - A second level of 17 cities and potential areas (hotspots), with their own panels, sourced facts and CTA (`&site=`). Planned labs (Bekasi, Bandung, Yogyakarta) are labelled PLANNED.
  - "Sources & confidence" drawer listing every fact with URL, year and an H/M/L badge (low-confidence facts appear only there), a "What we don't know yet" note and an "Entry path" strip (type approval, importer ID, SNI, PDP Law) phrased as steps we help with.
  - Keyboard (Enter, Esc), touch (tap plus bottom sheet), reduced motion, a visually hidden region list, and a scroll button plus a one-shot, passive wheel/touch assist to `#gap` (no `preventDefault`). The assist only fires when the wheel or touch did not start over the map frame or the card, the page is at the top (scrollY < 8) and no card is open; a wheel over the map scrolls the page normally and never zooms.
  - Rebuilt for speed and a steady layout (hero map v2, `docs/research/hero-map-v2-plan.md`):
    - One `<path>` of dots per region instead of 4,659 circles (about 24 SVG nodes), no per-dot transitions and no shimmer. Hover runs in one `requestAnimationFrame` and writes DOM attributes, with hysteresis so crossing a strait never flashes Maritime. Measured at 4x CPU throttle: click to next frame 64 ms (was 488 to 644), running animations 12 (was 6,424).
    - The hero is exactly one viewport tall and the card sits inside the map frame, so selecting never moves the page or resizes the hero, and the CTA stays visible (1440x900, 1280x720, 2000x1150, and the mobile peek sheet).
    - The card is compact: three stat tiles (verbatim figures from the sourced sentence, each with a source tag that opens the Sources drawer at that fact), stressor chips, an SMK line ("potential reach, not partners"), Tests / Sites / Why tabs, a pinned CTA and `overscroll-behavior: contain`.
    - Selecting zooms the map to the region (CSS transform, click, tap or Enter only: no wheel, pinch or pan; instant with reduced motion). Pins and labels are placed without collisions, and clicking a pin always opens that pin's card.
    - The lenses are one toolbar row (popovers for I build, Stressor and Month, toggles for Access and SMK reach). On phones the card is a peek sheet with the CTA in view that expands to a full sheet.
    - Focus moves without scrolling the page (`focus({preventScroll:true})`).
  - Map data is generated by `scripts/build-hero-map.ts` from Natural Earth 1:10m admin-0/admin-1 (public domain) into `apps/web/src/hero-map-data.ts` (0.2° grid, about 1.8 KB gzipped). `indonesia-dots.ts` and the second map in `#network` are gone: `#network` is now a planned-labs strip.
  - `/` in Indonesian keeps the previous hero; `/id` is unchanged.
- Test context on inquiries: `/partner?region=&build=&month=&stressor=&site=` (unknown values ignored) shows a "Your test context" summary, and the inquiry stores optional `region`, `build`, `month`, `stressor` and `site`. They show in the backoffice inbox. Additive: inquiries are JSON rows, so no migration is needed.
- `apps/web/src/company.ts`: one config for company legal details and commitments (PT name, NIB, address, reply time, price band). Placeholders render only on local hosts (localhost, `*.localhost`, 127.0.0.1), the desktop app and staff presentation mode, with a "[placeholder]" marker, and are omitted everywhere else (fail closed). Inquiry `site` only accepts known hotspot ids.

### Changed
- Prerendered `/` leads with the new headline and subline; meta, Open Graph and `llms.txt` updated.

### Fixed
- Visitors in Indonesia who had already opened `/id/` were no longer redirected there from `/` (the geo redirect only matched an empty region cookie). A region cookie of `id` now always redirects, and the "Global site" choice lasts only for the browser session.
- Blank page after a deploy for visitors with a cached page: hashed `/assets/` files now return 404 when missing instead of `index.html`, are cached as immutable, HTML is revalidated (`Cache-Control: no-cache`), and web deploys keep the previous builds' assets for 30 days.

## [0.6.0] - 2026-10-12

Business operations and invitation-only access: AIoT rebrand, partner intake and CRM, Lab Mitra commissions with a school portal, multi-provider AI on owner keys, per-person staff logins on admin.iot.ai.id, and invited member accounts on iot.ai.id.

### Added
- Public host (iot.ai.id): gated areas (Products, Builders, PhysicalBench, Arena, Build, Sites, Design, the `/id` leaderboard and the Learn start button) are invitation-only ("By invitation" / "Khusus undangan") with Request access, Sign in and WhatsApp actions, and their nav links are hidden from visitors who cannot open them. They are noindex and left out of the sitemap and llms.txt. localhost, the desktop app and admin.iot.ai.id are unaffected.
- Member accounts (ADR 009 addendum): invited clients, partners and schools sign in at `/masuk` (alias `/login`) and unlock areas by grant (`products`, `bench`, `arena`, `builders`, `installer`). `/profile` (alias `/profil`) shows name, organization, unlocked areas, Request access for locked ones, Sign out, and the installer button only with the `installer` grant. A header Sign in link becomes the member's name. Routes `/ops/v1/member/{activate,login,logout,me,installer}` (cookie `aiot_member`, `X-AIoT-Member` CSRF header), admin routes `/ops/v1/admin/members`, a Members section in the backoffice (`#bo-members`, owner and sales) and nginx locations for the public host. `OPS_INSTALLER_URL` sets the installer redirect.
- Presentation mode: a signed-in staff member visiting iot.ai.id sees everything unlocked, with a "Presentation mode" pill (view as public, back to admin). Backed by `GET /ops/v1/staff/preview` (name and role only, exact-origin CORS). The backoffice header gets a "Present site" link.
- Staff accounts for the admin host (ADR 009 addendum):
  - `admin.iot.ai.id` replaces HTTP Basic with a landing page and per-person login (owner, sales, ops, viewer): invite activation, password login with lockout, `aiot_admin` session cookie, and a signed-in name, role and Sign out in the backoffice header.
  - Owner-only Team section (`#bo-team`) to add people (one-time invite code), change roles, disable and reset invites; the last active owner is protected.
  - Ops routes `/ops/v1/staff/{activate,login,logout,me}`, owner routes `/ops/v1/admin/staff`, and the internal `GET /ops/v1/staff/check` for nginx `auth_request`. Login, invite and session code is shared with the school portal (`services/ops/auth.ts`).
  - Bootstrap CLI: `node --import tsx services/ops/cli.ts staff-invite <username> <role> [name] [--force]`.
  - Nginx (deployed 2026-10-11): admin host drops Basic auth, adds `auth_request` on `/api/`, the `iot_staff_auth` zone and a 404 for the public `/ops/v1/staff/check`; the main host answers 404 for all of `/ops/v1/staff/`. The API host keeps Basic.
- Lab Mitra commissions (ADR 010):
  - Append-only commission ledger (SQLite triggers reject UPDATE and DELETE; corrections are reversal rows) with balances derived by SUM.
  - School portal at `/mitra` for school admins and teachers, served at `/ops/v1/portal/*`: invite-code activation, password login with lockout, `aiot_portal` session cookie, CSRF header, strict per-school isolation.
  - Teachers propose per-student allocations of the 60% student pool, school admins approve them under a two-person rule, and schools confirm distribution.
  - Payout batches in the backoffice (`#bo-commissions`): create from approved allocations, mark paid with a transfer reference, download CSV. Commissions are always paid to the school account.
  - Students are stored with guardian consent and minimal data only.
- Portal hardening: stale allocations are voided on reassignment or lead change, invite resets are restricted, ledger corrections are whole-allocation or whole-accrual reversals, invite codes carry a lookup id, scrypt is asynchronous, lockout is per person and IP, sessions have idle timeout and a cap.
- Nginx rate zones `iot_portal` (60 r/m, burst 30) and `iot_portal_auth` (5 r/m) for the portal (deployed 2026-10-11).
- `admin.iot.ai.id` opens the backoffice at its root; `/backoffice` there redirects to `/` and keeps the section hash. Local installs keep `/backoffice`.
- AI provider adapter layer (`packages/ai-providers`): OpenAI, Anthropic Claude, MiniMax and Z.ai GLM, plus OpenAI-compatible endpoints and signed-in Codex or Claude Code CLIs on the desktop. AI settings show one card per allowed provider with model choice and an active provider. TypeSafe/Jev routing is now optional and skipped when unavailable.
- Desktop: bring-your-own-key stays on the user's computer; the desktop app is renamed AIoT.
- `/partner`: partner inquiry form for vendors, distributors, schools and investors. It shows a reference number, offers a WhatsApp follow-up and falls back to WhatsApp on failure. Header, hero and footer CTAs now lead here.
- Ops service (`services/ops`, ADR 009) with a shared contract in `packages/ops-contract`. The public routes are `POST /ops/v1/inquiries`, `GET /ops/v1/catalog` and `GET /ops/v1/labs`; admin routes are reached only through the authenticated API at `/api/ops/*`.
- Backoffice business panels:
  - Inquiry inbox with status, assignee, notes, history and convert-to-organization.
  - Organizations CRM (vendors, distributors, schools, customers).
  - Product catalog with a localization checklist.
  - Lab Mitra tasks with payouts.
  - KPI summary.
- Roles: owner, sales, ops and viewer, set with `OPS_ROLES` and mapped from the gateway login. Empty `OPS_ROLES` means a single owner.
- `/products`: public catalog of tested products. A product appears only when it is published and available, with evidence, a test summary and a complete localization checklist (SDPPI required for wireless devices).
- Lab Mitra tasks: open → assigned → submitted → verified/rejected → paid. Fees split 60% students / 25% TEFA / 15% teacher, and the backoffice tracks payouts due and paid.
- `/id` partner board lists real active schools that opted in, then open slots.
- Consent-gated conversion tracking (GA4, Meta Pixel). It is inert unless `VITE_GA4_ID` or `VITE_META_PIXEL_ID` is set at build time.
- The partnership brief points to `/partner` and WhatsApp.

### Changed
- The public host no longer links the desktop release downloads (footer, pages): members get the installer from their profile and anonymous visitors are pointed to Request access. The GitHub release assets stay public until they are moved to private storage; the gate controls our links only.
- Tasks are marked paid when their payout batch is marked paid; the per-task "Mark paid" action is removed. Tasks can carry a lead teacher set at assignment.
- Brand name is now **AIoT**; the domain stays `iot.ai.id`. Header, loader, footer, tab titles, Open Graph and JSON-LD use the new name (`alternateName: iot.ai.id`).
- Positioning: "The real-world gateway for AI robotics in Indonesia": field testing, localization, distribution and real-world data. New hero copy in EN and ID, footer line "Tested in Indonesia. Ready for Indonesia." (ID: "Diuji di lapangan. Siap dipasarkan."), updated `llms.txt` pitch.
- WhatsApp prefilled messages on `/id` greet AIoT.
- `package.json` version is now 0.6.0.

### Security
- Cloud AI runs only on owner keys: end-user keys, custom endpoints and CLI providers are refused when `IOT_DEPLOYMENT=cloud`. The vault master key moves to `IOT_VAULT_KEY_FILE` outside the data volume (an identical old copy is removed, a different one aborts startup). AI settings changes are written to an append-only audit log without key material, and cloud AI calls have a daily limit (`IOT_AI_DAILY_LIMIT`, default 300).
- Public intake:
  - Honeypot field.
  - Per-IP and global rate limits, plus an nginx `limit_req` keyed on `CF-Connecting-IP`.
  - Explicit consent and body size caps.
- Ops admin routes are never served on the public host: `/ops/v1/admin/` returns 404 there. They require a 32+ character owner token compared in constant time, and public proxies strip `Authorization` and `X-Ops-User`.
- The admin gateway authorizes every `/api/` call with `auth_request` against a live staff session and forwards the staff username as `X-Remote-User`; the API host still forwards its HTTP Basic user.
- Member, staff and school portal sessions are isolated by kind; usernames are unique across all three. A non-HttpOnly `aiot_member_hint` cookie only decides whether the site probes the member API and never grants access.

## [0.5.0] - 2026-10-11

Device adapter specification and release tooling.

### Added
- ADR 008 and `packages/device-adapter`: device adapter protocol v1 for partner hardware (robot hands, tactile sensors). One adapter per device family wraps the vendor SDK behind 13 fixed JSON-RPC methods. Includes manifest, channel model, session state machine and conformance requirements.
- `CHANGELOG.md` covering every release since 0.1.0, with local annotated tags `v0.1.0`–`v0.5.0`.
- `npm run release:notes`: drafts the next entry from commits since the last tag, grouped by commit type with a security keyword check.

### Changed
- `deploy/nginx.conf` now carries the Indonesia geo redirect that has run in production since 0.4.0, so the repository matches the live gateway.
- `package.json` version follows the changelog (now 0.5.0).

### Security
- Adapter safety model: no actuation before human-approved `arm`; commands outside the run envelope are rejected (never clamped); envelopes cannot exceed vendor limits; `stop` callable in every state; heartbeat deadman; hardware stop required for risky devices; only signed adapters may run physical tests; adapters report observations, never pass/fail.

## [0.4.0] - 2026-10-10

Indonesian ad landing for vocational schools (SMK).

### Added
- `/id/` landing for Program Lab Mitra: paid test-task rates, 60/25/15 payout split, 4-step flow, three packages (Rp1.490.000 per teacher, Rp9.900.000 per school, agency on request), empty Lab Mitra leaderboard, principal FAQ and a sticky WhatsApp CTA on mobile.
- Every CTA opens WhatsApp with a prefilled message per package (`data-cta` hooks for ad conversion tracking).
- Geo redirect at the origin: visitors Cloudflare marks as Indonesia, without an `iot_region` cookie, are sent from `/` to `/id/` (query string kept for UTM). "Global site (EN)" sets the cookie so the choice is remembered for a year.
- Static Indonesian prerender for `/id/`, `hreflang` alternates between `/` and `/id/`, sitemap and `llms.txt` entries.
- Footer link from the global site to the Indonesian program.
- Higgsfield visuals for the SMK lab, teacher and training kit.
- e2e spec `13-landing-id` (WhatsApp targets, cookie, overflow at three widths, FAQ, switch to global).

### Changed
- `LangProvider` sets `<html lang="id">` on `/id` regardless of the site-wide language toggle.

### Fixed
- `<html lang>` was reset to `en` after the Indonesian page mounted.

### Security
- Ad copy states per-task rates only, no income promises; certificates are labelled as iot.ai.id, not BNSP; photos are labelled as illustrations; the leaderboard shows no invented schools.
- The region cookie holds only `id` or `global`, `SameSite=Lax`, no personal data.

## [0.3.0] - 2026-10-10

Public website relaunch: English-first, real-world verification positioning.

### Added
- New landing: clinical capsule hero, scenario atlas with six field renders, stats, verification loop with typed evidence record, halftone Indonesia map, partner band, final CTA; built on GetLayers compositions.
- EN/ID language toggle (English default, remembered per browser).
- SEO and GEO: static prerender for 60 routes, sitemap, robots (AI crawlers allowed on public pages), JSON-LD, Open Graph image, `llms.txt` and `llms-full.txt`.
- Per-route tab titles.
- Design system: tokens as the only place for raw colours (`npm run check:tokens` guard), UI primitives, shared header/footer/page shell, rolled out to every page including backoffice and workbench.
- Dot-matrix Indonesia logo (67 dots, live dot on Java) in header, footer and favicon; animated loader with scan, Java lock, pulse and wordmark reveal.
- Partnership brief download.

### Changed
- Header is sticky on all viewports and gains a blurred background on scroll.
- Page components split out of `main.tsx`.

### Fixed
- Canonical and sitemap URLs use trailing slashes to match nginx directory routing.
- Landing link styles no longer override primary buttons.
- Workbench header no longer pushes the site canvas.
- Loader dots no longer trail the scanline.

### Security
- `robots.txt` disallows `/api/`, `/backoffice`, `/build`, `/project/`, `/site/`, `/sites` and `/design` for all crawlers.

## [0.2.0] - 2026-10-09

Cloud deployment, desktop installers and owner AI settings.

### Added
- Protected cloud deployment (Docker Compose, nginx gateway, certificate renewal).
- Native desktop installers: macOS DMG and Windows x64 NSIS via a GitHub Actions workflow.
- Private knowledge service (OpenViking) for the workspace.
- Owner AI settings in the backoffice for OpenAI and TypeSafe keys, with a connection test.

### Changed
- The workspace stays usable without AI configured; planning and chat fail explicitly instead of falling back silently.
- Cloud documentation clarifies that USB hardware access stays on the local desktop.

### Fixed
- Windows installer metadata.
- The dashboard link opens AI settings directly.

### Security
- The public site no longer exposes the workspace: the testing login was removed and `/api/` on the public host returns 403. The workspace is reachable only on the admin host behind authentication.
- Origin allowlist on every iot.ai.id host.
- AI provider keys are encrypted at rest (AES-256-GCM, per-provider authenticated data, owner-only file permissions) and write-only in the UI: only a fingerprint and test status are ever returned.
- Windows packaging verifies downloaded Node and Arduino CLI binaries against official SHA-256 checksum manifests.
- Installers are unsigned testing artifacts (no notarization, no Authenticode); stated in the docs.

## [0.1.0] - 2026-10-08

Initial public snapshot of the hardware workspace.

### Added
- Hardware contract, deterministic validator, component catalog and hardware library.
- Local runtime around `arduino-mcp-server`: USB detection, compile, flash and serial evidence for the ESP32 reference build.
- Identity-bound evidence and verification (`VERIFIED` only from physical evidence; simulation labelled separately).
- Edge execution with cloud coordination, school visual workbench, sites, challenges and episodes.
- Electron desktop app with a loopback-only backend.

### Security
- Local API accepts loopback Host/Origin only and requires a session token; physical runs need a human-authorised USB port (20-minute trust window).

[Unreleased]: https://github.com/dansya-arsana/iot-ai-id/compare/c7ded87...HEAD
[0.7.0]: https://github.com/dansya-arsana/iot-ai-id/compare/3c34f75...c7ded87
[0.6.0]: https://github.com/dansya-arsana/iot-ai-id/compare/7937777...3c34f75
[0.5.0]: https://github.com/dansya-arsana/iot-ai-id/compare/2bbbaa3...7937777
[0.4.0]: https://github.com/dansya-arsana/iot-ai-id/compare/6ea1215...2bbbaa3
[0.3.0]: https://github.com/dansya-arsana/iot-ai-id/compare/eb01b3f...6ea1215
[0.2.0]: https://github.com/dansya-arsana/iot-ai-id/compare/6f232b7...eb01b3f
[0.1.0]: https://github.com/dansya-arsana/iot-ai-id/commit/6f232b7
