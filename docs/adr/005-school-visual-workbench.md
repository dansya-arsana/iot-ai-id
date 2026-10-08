# ADR 005: A visual workbench for school learners

Status: implemented locally; usability with real students and physical hardware remains to be validated.

## Decision

The user supplied a visual circuit-editor reference. The project workbench now presents a component shelf, a dotted-grid circuit canvas and a learning companion, with Indonesian Design/Code/Test controls. The existing ESP32, BME280 and SSD1306 recipe remains the executable boundary.

Shelf and canvas selection are synchronized and keyboard accessible. Pin guidance comes from the canonical Hardware Contract. Wokwi Elements supplies ESP32 and OLED visuals; BME280 is a labeled manifest illustration. No component dragging, wire editing, simulator engine or editor embedding is implied. Layout and checklist state remain local instructional aids.

The companion provides deterministic guidance from the current project state, while actual AI plans and diagnoses remain inspectable. It does not fabricate a live conversation. Source-code viewing, copying and download remain available.

## Evidence and learning records

Every displayed verification, reading and repair belongs to the latest experiment. A fresh unfinished run cannot inherit an older passing result. Current runtime errors appear as unsuccessful operations, with their error reason visible.

Model practice explicitly executes no board or firmware. Physical execution still requires a valid contract, working toolchain, detected and authorized USB port, and idle runtime. Recovery requires a user-confirmed repair, a failed parent and the same evidence mode. Physical wiring changes remain human actions with power off.

A learner can save an observation or reflection through the existing immutable action API. Records identify human-reported versus test-fixture provenance and may refer to the current contract and experiment. They stay local, cannot satisfy runtime checks, and never grant research or model-improvement permission. Full measurements, history and purpose-specific export gates remain available in the episode page. No real learner identities or school participation are claimed.

## Verification

Typecheck, lint, 35 regression tests and production build pass. Native browser checks cover component selection by keyboard and canvas, keyboard tabs, code view, blocked physical execution without USB, model SDA failure and parent-linked recovery, mode-bound repair confirmation, and saving a labeled fixture note. Desktop and 390-pixel mobile layouts have no horizontal overflow.

Real hardware verification and school usability evaluation remain separate milestones. The visual canvas is not electrical proof; OLED ACK is not a measurement of visible pixels.
