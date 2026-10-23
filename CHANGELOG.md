# Changelog

All notable changes to iot.ai.id. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [Semantic Versioning](https://semver.org/) (pre-1.0: minor = feature release, patch = fixes only).

Each release is a local annotated git tag (`v0.x.y`). Draft the next entry with `npm run release:notes`, which groups commits since the last tag.

## [Unreleased]

### Changed
- Pro top bar: the prompt button reads Regenerate (Cmd or Ctrl + Enter) once a design exists, and Generating… while a turn runs. The chat drawer has its own header row, so the close button no longer overlaps the chat. The 3D toolbar's isolate and hide now share state with the feature tree, so the Isolated chip appears. `/pro/dev` loads a checklist from the server generator instead of the 5-item stub. Below 700 px the workspace shows the dock panel only.
- The Arduino lab is invitation-only for now: new member grant `lab` gates `/lab`, `/lab/:lesson`, `/lab/parts` and `/lab/parts/:kind` on iot.ai.id. Staff presentation mode and localhost/desktop stay open. Nav, footer and the Learn card hide Lab links without access; lab pages are noindex shells, removed from the sitemap, llms.txt and llms-full.txt. `GET /ops/v1/member/lab/examples` now requires a member with `lab` or staff (needs a deploy-ops). Backoffice grant label "Arduino lab".

### Added
- Compile sidecar: `services/compiler/server.ts`, `deploy/Dockerfile.compiler` and a `compiler` service in `deploy/compose.yml`. Production can now compile for real (AVR for Lab AI, ESP32 and AVR for Pro `compile_code`, Python lint) with no docker socket. Ops calls it over HTTP on a new internal `compile` network (no internet egress) with a bearer `COMPILER_TOKEN` (32+ characters). Read-only root, no capabilities, one job at a time (queue of 4, then 429), a temp dir per job, hard timeouts, strict file names and include screening. Ops uses it when `OPS_COMPILER_URL` and `COMPILER_TOKEN` are set, else the Docker runners (local dev). `scripts/ci/smoke-image.sh --compiler` builds it and checks health, auth and an AVR compile. Deploy: deploy-ops creates `COMPILER_TOKEN` in `ops.env` and a token-only `compiler.env`, then builds `compiler` with api and ops.
- Pro workspace v2 (grant `pro`): the dock now has Wiring, Code, Checklist, BOM, Power and Checks tabs with counts from the stored spec and a maximise toggle. Wiring is an auto-laid-out diagram with pin and cable tables (SVG export, A4 print). Code shows compile status and `not run on hardware` for every file. The checklist shows per-phase progress and a 390 px phone layout. BOM and Power show IDR ranges as "estimate". Checks has a provenance popover. "verified" appears only on gated items, and each unverified item says why.
- Build Sheet: `/pro/print/:projectId/:revision` (gated like `/pro`, `noindex`, opened from the Build Sheet button in a new tab). It is English, A4, printed from the browser with "Save as PDF", and uses saved revisions only. The title block shows `DESIGN · NOT BUILT`, or `FLASHED n/N` when evidence is passed. Unverified items have their own section.
- Draft revisions are labelled DRAFT in the top bar and revision menu. The Build Sheet button is off for a draft.
- `npm test` also runs the Pro panel unit tests in `apps/web/src/pro/*/*.test.ts`. New e2e `tests/e2e/41-pro-v2.spec.ts` saves screenshots and the A4 PDF to `test-results/pro-v2/`.
- Pro workspace (invitation-only, grant `pro`): `/pro` and `/pro/:projectId` mount the feature tree, 3D assembly (CadViewport), site plan, properties, and a chat drawer (agent stream, tool cards, saved-revision markers). `/pro/dev` is local only (staff or desktop) and shows the farm fixture; all are noindex. e2e `40-pro`.
- Catalog: 22 new hand-sourced part records (`packages/catalog/data/<kind>.json`) now overlay the imported catalog by id. New lab parts: rpi-4b, rpi-5, rpi-pico, esp32-s3-devkitc, lora-rfm95w (SX127x core, default radio), lora-ra02 (Learn only, 433 MHz), rpi-lora-hat, max485, soil-npk-rs485, soil-capacitive-v2, bh1750, rain-gauge-tipping, solenoid-valve-12v, pump-12v-r385, solar-panel, solar-charge-pwm, battery-18650-pack, battery-lifepo4-12v, enclosure-ip65, din-rail-terminals. The bh1750 record now describes the GY-302 module (3-5.5 V) and replaces the imported one.
- Pro hardware bridge `/api/pro/hardware/*` (ESP32 detect, flash with esptool, serial) and telemetry `/api/pro/telemetry/*` (LAN MQTT subscribe only, no publish), both local API only, never mounted in the cloud. Flash needs a one-time native consent token bound to port and file sha (desktop consent v2); the desktop main process now forwards the consent options. New dependency `mqtt` (lazy-loaded, desktop and local API only, for the telemetry subscriber).
- `evidence_status` tool reads stored evidence ticks and anomalies (stuck value, out of range, boot loop) next to the checklist.

- Pro architect backend (invitation-only, new member grant `pro`; plan rev 3, ADR 012). Not yet visible to members: the workspace UI comes in M5.
  - Agent loop in ops (`/ops/v1/member/pro/*`): projects, immutable revisions, turns streamed as Server-Sent Events (with a long-poll fallback), browser tool results. At most 40 tool calls and 15 minutes per turn; one global monthly USD kill-switch (default USD 1000, admin can disable it). Usage is recorded per member and per project; there are no budgets or quotas yet.
  - Model proxy in the api (`/internal/pro/messages`, token-gated, never routed by nginx): Claude Sonnet 5.5 or Opus 5.5 chosen in admin AI settings, with effort and thinking-display controls and the kill-switch. Adaptive thinking (Claude 5.5 rejects `budget_tokens`). The key stays in the api container; the vault wins over `ANTHROPIC_API_KEY`. Pinned prices are in `packages/pro-contract/pricing.ts`.
  - 20 tools behind one dispatcher (grant, project ownership, strict input, rate limits, untrusted-text wrapping, output check), also exposed over MCP: parts catalog search, compatibility, pin allocation, netlist, power, link margin (LoRa 920-923 MHz only; Kominfo limits are information, RA-02 is an error), site climate, BOM pricing, sandboxed compile (ESP32, AVR, Python lint), `save_revision` with a server-side verification gate that stamps every item verified, unverified or failed.
  - Parts catalog with per-field provenance (`packages/catalog`, about 100 parts merged from the hardware library, component catalog, golden manifests and the lab registry), staff overlay and proposals in ops, and a backoffice Catalog page (low-confidence, stale and unverified filters, proposal queue, Tested-in-lab badge that needs a verified Lab Mitra task). Run `npm run catalog:import`, `catalog:check` and `catalog:export`.
  - Three staff-authored skills (agri-id, lora-as923-id, power-solar-tropics), sandbox images in `scripts/pro-sandbox/`.
  - nginx: `iot_pro` zone, an unbuffered location for Pro turn events, 256 KB bodies for Pro routes, the staff catalog route on the admin host, `/internal/` closed on the api host. `scripts/ci/smoke-image.sh` also checks the catalog, Pro and internal routes.
- Arduino lab (invitation-only, grant `lab`; `/lab`, `/lab/:lesson`): 26 guided lessons on an emulated Arduino UNO. Precompiled ATmega328P firmware runs in avr8js in the browser, in a lazy-loaded chunk with a three.js board scene. Free, no sign-in.
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
- Lab parts wave (17 new kinds, all auto-registered): ESP32-DevKitC (38-pin map, model only), Arduino Nano-style board (model only), 9 V battery, 4xAA holder, capacitor (real RC charge and leak), BME280 (I2C 0x76/0x77, real registers, Bosch compensation), OLED SSD1306 (I2C 0x3C, 128x64 buffer from the command and data stream), LCD1602 with PCF8574 backpack (4-bit HD44780), soil moisture, water level, PIR HC-SR501 (settling, hold, jumper), MQ-2 gas (warm-up, DO comparator), IR receiver (NEC), 7-segment, relay module, L298N, and a 12 V load lamp.
- Lessons 13 to 16 with real compiled firmware: OLED dashboard, Motion light (PIR, relay, lamp), Plant monitor (soil to LCD and alert LED), Remote control (NEC IR to 7-segment).
- Parts gallery at `/lab/parts` and `/lab/parts/<kind>` (every registered kind rendered with its default props).
- `DeviceDef.runtime: 'not-emulated'` with an honest "Model only" badge in the gallery and the part popover (ESP32, Nano).
- Desktop app native consent: authorizing a board for upload opens an OS dialog; the backend only accepts a one-time HMAC token (60 s, one port). Local dev needs `AIOT_LAB_DEV_CONSENT=1`. See docs/lab-hardware.md.
- Lab catalog wave 2 (80 registered parts, 26 lessons). Every part simulates its real protocol at signal level, has EN and ID copy, a docs page in `docs/lab-parts/` and tests; real-firmware tests use our own minimal drivers (no GPL code).
  - Temperature and pressure: DS18B20 (1-Wire ROM, search, scratchpad, CRC8), LM35, NTC thermistor, BMP280 (Bosch compensation).
  - Motion and magnetic: MPU6050 (I2C, 0x68/0x69, interrupt), Hall A3144, reed switch.
  - Input: KY-023 joystick, KY-040 rotary encoder (Gray code), 4x4 keypad (ghost keys), TTP223 touch.
  - Environment: KY-038 sound, flame sensor, rain sensor, FC-51 IR obstacle.
  - Power and measurement: ACS712 current, voltage sensor module, HX711 load cell (24-bit, gain select), MB102 breadboard power, LM7805, AMS1117-3.3.
  - Switches, lights and diodes: slide switch, toggle switch, 10-segment LED bar, IR LED, photodiode, WS2812 strip, ring and matrix (800 kHz decode), KY-008 laser, KY-016 RGB module, coin vibration motor.
  - Clocks and comms: DS3231 RTC with AT24C32 EEPROM, HC-05 Bluetooth (data and AT mode), NEO-6M GPS (NMEA with checksums), ESP-01 (AT shell, no Wi-Fi), NodeMCU v3 (model only).
  - SPI: RC522 RFID (ISO 14443-A, 4 and 7 byte UIDs), MAX7219 chained matrix, microSD (SPI-mode card, raw blocks).
  - Displays: TM1637 4-digit, LCD2004 I2C, Nokia 5110 PCD8544.
  - Motion drivers: 28BYJ-48 stepper, ULN2003 board, MG996R servo, IRF520 MOSFET module, mini water pump.
- Lessons 17 to 26: Weather station (BMP280, DHT22, LCD2004), Tilt alarm (MPU6050), RFID door (RC522, servo, relay), Keypad lock, Rainbow pixels (WS2812 and encoder), Stepper control, Kitchen scale (HX711), Real-time clock (DS3231 and MAX7219), Motor driver (L298N), GPS logger (NEO-6M and Nokia 5110). Each is one module under `lab/lessons/<id>.ts` with its own sketch.
- Lab platform: SPI and bit-bang bus cores, part-to-part nets with a power solver and power warnings (over, under, external, conflict, dropout), Arduino Nano board with A6/A7, scaffolder flags `--protocol spi|twowire|ws2812`, `--desk`, `--power`, and one firmware file per sketch (`firmware/generated/<sketch>.ts`).
- Lab polish round: 3D direct manipulation (click keypad keys, drag the joystick stick, turn the encoder knob by dragging round it), an HC-05 popover that is a real text terminal, live hover demos and a "Try it" popover on the parts gallery, a protocol-aware generic Test Record (UART bytes, lines and baud; SPI transactions; I2C addresses; WS2812 frames and pixels), per-run firmware work folders with colima mount retries, simulated-time waits in the lesson 22-25 e2e specs, and a layout guard that checks every lesson for overlapping parts and jumpers drawn across display glass.

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
