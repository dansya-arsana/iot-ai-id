# Level ladder: execution plan

Status: draft for founder approval, 2026-10-23 (rev 2).

## Levels (agreed)

| Level | Who | How it "runs" | Status |
|---|---|---|---|
| Learn | SMK students, beginners | Chip emulation in the browser (AVR now, RP2040 next) | Done: /lab, 26 lessons, 80 parts |
| Make | Makers, advanced students | Free 3D sandbox, MicroPython for Pico and ESP32 | Later, separate plan |
| **Pro / Architect** | Engineers, farm and site owners, product teams, robotics companies | **No emulation.** Correct wiring, correct code ready to paste, a CAD-style view, and a printable Build Package | **This plan** |
| Field | Clients | Real hardware at Lab Mitra schools, field tests at the hero map locations | Existing ops and partner flow |

## What Pro does (founder brief)

A user types, for example: *"I'm building IoT for my farm. It has 4 fields: mango, melon, banana and flowers, and each needs different sensors."*

Pro generates:
1. **System architecture.** One node per field, each with a board, sensors and actuators picked for that crop (e.g. melon gets soil moisture + drip valve + temp/humidity; flowers get light + misting). Plus a gateway (e.g. Raspberry Pi), the links between them (LoRa, Wi-Fi or RS-485 with distances), power per node (solar/battery/mains) and an enclosure (IP rating).
2. **A CAD-style screen** with:
   - a component tree, like a feature tree, per site → field → node → part;
   - a 3D assembly with exploded view, isolate/hide, measure and section;
   - a site plan with the 4 fields and the gateway;
   - a 2D wiring view.
3. **Wiring plan per node.**
   - Colour-coded wires labelled `W1 · GPIO4 → DATA (DS18B20)`, with connector and terminal callouts and cable lengths.
   - Pin tables.
   - A step-by-step assembly that reuses `playAssembly`.
4. **Code per board, ready to paste.** One copy button per file, e.g. `node-melon.ino` and `gateway.py`, with pins and thresholds already filled in from the design.
   - **Verified, not emulated:** Arduino/ESP32 code is compiled in the existing sandbox (arduino-cli, ESP32 core). Python is syntax- and lint-checked. Pin names in the code are cross-checked against the wiring.
   - The UI says plainly "compiled ✓ · not run on hardware".
5. **Automatic to-do checklist.** Procurement → flash each board → wire each node (one item per wire) → power-up checks → field install → calibration. Ticks are saved per project, and the progress shows per node and per field.
6. **Build Sheet PDF**, architect-grade, A4, EN/ID:
   - a cover and a site plan;
   - per node: a 3D view, the wiring diagram, pin tables and the code listing;
   - the BOM with an IDR price range, the power budget, the design checks, the checklist and a test plan.

## Principle: the model thinks, we provide verified hands (founder brief, 2026-10-23)

Use cases will vary without limit. The farm is only a sample. We do **not** constrain Sonnet/Opus into a fixed pipeline. The model reasons and mix-matches freely. Our job is to give it **verified data and tools**, so every design it assembles rests on facts, not guesses.

1. **One verified catalog, the single source of truth.** Merge packages/hardware-library, component-catalog, hardware-contract and the lab part registry. Each part record holds:
   - identity: name, variants, aliases;
   - electrical: supply range, logic levels, current, absolute maximums;
   - pins: map and alternate functions;
   - protocols and addresses;
   - mechanical: mm, mounting, connector types;
   - environment: temperature range and IP rating, which matter in the tropics;
   - compile-verified driver snippets per board family;
   - known pitfalls;
   - compatible boards and modules;
   - IDR price range and local availability, dated;
   - a 3D/visual model.
   **Every field carries provenance**: source URL, who verified it, the date and a confidence level. A part can also earn a **"Tested in AIoT lab"** badge once a Lab Mitra school has verified it physically. That ties the catalog back to the business.
2. **Tools ("hands") over the catalog**, exposed as function calls AND through our MCP server so any Claude client can use them:
   - search and get a part;
   - check compatibility (voltage, logic level, protocol and address clashes, current);
   - validate a wiring netlist;
   - solve power and solar/battery sizing;
   - compile or lint code in the sandbox;
   - price a BOM;
   - read site climate from the hero map data;
   - render the 3D assembly, 2D wiring, checklist and Build Sheet;
   - save a design revision;
   - real-time: detect a device, flash it (human consent), read serial and read telemetry.
3. **Skills and history are seasoning.** Domain packs (agriculture, warehouse/AMR, buildings, regulation) load on demand. Project conversation history persists. Nothing here limits the model's reasoning.
4. **Verification gate, not a cage.** The model may propose anything. Only what passes the tools reaches the Build Sheet, marked "verified". Anything unverified is shown as such.

## AI model and key (founder brief)

- The platform AI for Pro (and the Lab builder) defaults to **Claude Sonnet 5.5** (`claude-sonnet-5-5`). It is selectable in the admin backoffice.
- **Key storage, secure:** the Anthropic key is set in the admin backoffice **AI settings**. It is write-only and stored in the existing encrypted vault (AES-256-GCM; the master key file lives outside the repo, in `/opt/iot-ai-id/secrets/vault.key`). It is never returned to the browser, never logged and never committed.
  - As an optional fallback, `ANTHROPIC_API_KEY` may be set in the server's secrets env file (outside the repo, `chmod 600`). The vault value wins when both are set.
  - A daily spend and request limit per member and globally, plus an audit log, already exist; Pro reuses them.
- Calls go only from the api container, so the public host never sees a key. ops calls api over the internal network (ADR 011).
- Structured output: the model must return a validated `SystemSpec` (zod). That covers sites, fields, nodes, CircuitSpec per node, code files, BOM lines and checklist items. A spec that fails validation is repaired once, then refused.

## Working rules (so it doesn't take days again)

1. **Approve before building.** UI milestones start with a one-page spec and mockups. The founder approves once, and changes go to the next milestone.
2. **One vertical slice first:** the **4-field farm** reference case, end to end. Fan-out comes after that.
3. **Time box per milestone.** At most about one working day of agent time. If it runs over, cut scope; don't extend.
4. **One review and one fix round.** After that, open items go to `docs/plans/backlog.md`.
5. **Tiered tests:**
   - unit and contract tests on every change (under 2 min);
   - e2e only for the areas touched;
   - the full e2e suite once before deploy;
   - an image smoke test in CI.
6. **Disjoint files per agent.** One integrator; no stash or half-done WIP.
7. **Small deploys.** Deploy and show the founder after every milestone.

## Milestones

| # | Milestone | Time box | Done when |
|---|---|---|---|
| M0 | Finish the /lab gate (invitation only). CI: GitHub Action with `npm run check` plus a Docker image smoke test. Shard e2e to get under 10 minutes. | 0.5 d | CI green; /lab shows "By invitation" to anonymous visitors |
| M1 | **Pro spec + mockups** for the 4-field farm: the CAD screen (tree, 3D, site plan, wiring), the code panel with copy, the checklist, and 3 Build Sheet PDF pages | 0.5 d | Founder approves |
| M2 | **SystemSpec + AI pipeline:** a zod schema for site → fields → nodes → CircuitSpec + code + BOM + checklist; Sonnet 5.5 default in admin AI settings; vault key with an env fallback; generate, validate, repair once; compile-verify (ESP32 core in the sandbox image) and Python lint | 1 d | The farm prompt gives a valid spec; every file compiles or lints; pin cross-check passes |
| M3 | **Board and field parts:** Raspberry Pi 4/5, ESP32-S3, Pico, LoRa SX1276/RA-02, RS-485 MAX485, solenoid valve, pump relay, capacitive soil probe v2, DS18B20 probe, light sensor BH1750, rain gauge, solar charge controller + panel + 18650 pack, IP65 enclosure. Parallel agents, file-only, model-only badges. | 0.5–1 d | Contract test green; gallery shows them |
| M4 | **CAD view:** component tree, 3D assembly per node (exploded, isolate, measure, section), site plan view | 1 d | The farm renders with all 4 nodes and the gateway; tree selection syncs with 3D |
| M5 | **2D wiring diagram + pin tables + cable list** per node (auto-layout from the netlist, wire IDs, lengths, SVG) | 1 d | Each farm node's diagram is readable on A4 |
| M6 | **Checklist + BOM + power + design checks** panel (ticks saved per project, IDR price range, battery and solar sizing) | 0.5 d | The farm checklist auto-generates and progress persists |
| M7 | **Build Sheet PDF** (all sections, EN/ID) and **the `/pro` workspace** (grant `pro` or staff; save and load in the ops DB; "Send to a lab for build/test" prefilling /partner) | 1 d | One-click PDF of the farm; a member with `pro` can run the whole flow |

M3 and M4 can run in parallel after M2, and so can M5 and M6.

## Explicitly not in this plan

- CPU emulation of ESP32, STM32 or Raspberry Pi.
- Running the generated code. It is compile- or lint-verified only, and the UI says so.
- KiCad/PCB export: maybe M8.
- The Make-level sandbox and MicroPython: separate plan.

## Decisions needed

1. Approve rev 2.
2. The reference case is the 4-field farm (mango, melon, banana, flowers). Gateway: Raspberry Pi. Field links: LoRa by default, with Wi-Fi as an option.
3. Pro access: grant `pro` plus staff at first.
