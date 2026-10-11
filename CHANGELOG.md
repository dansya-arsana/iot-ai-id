# Changelog

All notable changes to iot.ai.id. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [Semantic Versioning](https://semver.org/) (pre-1.0: minor = feature release, patch = fixes only).

Each release is a local annotated git tag (`v0.x.y`). Draft the next entry with `npm run release:notes`, which groups commits since the last tag.

## [Unreleased]

### Changed
- Brand name is now **AIoT**; the domain stays `iot.ai.id`. Header, loader, footer, tab titles, Open Graph and JSON-LD use the new name (`alternateName: iot.ai.id`).
- Positioning: "The real-world gateway for AI robotics in Indonesia": field testing, localization, distribution and real-world data. New hero copy in EN and ID, footer line "Tested in Indonesia. Ready for Indonesia." (ID: "Diuji di lapangan. Siap dipasarkan."), updated `llms.txt` pitch.
- WhatsApp prefilled messages on `/id` greet AIoT.

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

[Unreleased]: https://github.com/dansya-arsana/iot-ai-id/compare/7937777...HEAD
[0.5.0]: https://github.com/dansya-arsana/iot-ai-id/compare/2bbbaa3...7937777
[0.4.0]: https://github.com/dansya-arsana/iot-ai-id/compare/6ea1215...2bbbaa3
[0.3.0]: https://github.com/dansya-arsana/iot-ai-id/compare/eb01b3f...6ea1215
[0.2.0]: https://github.com/dansya-arsana/iot-ai-id/compare/6f232b7...eb01b3f
[0.1.0]: https://github.com/dansya-arsana/iot-ai-id/commit/6f232b7
