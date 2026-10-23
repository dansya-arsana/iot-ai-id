# Pro compile sandbox

Backs the Pro `compile_code` tool (`services/ops/pro-compile.ts`). Compile or lint only, never execute.

| Target | Image | Build |
|---|---|---|
| esp32, esp32s3 | `aiot-pro-esp32:3.3.12` | `docker build -f scripts/pro-sandbox/Dockerfile.esp32 -t aiot-pro-esp32:3.3.12 scripts/pro-sandbox` |
| python, micropython | `aiot-pro-py:1` | `docker build -f scripts/pro-sandbox/Dockerfile.py -t aiot-pro-py:1 scripts/pro-sandbox` |
| uno, nano | `aiot-avr-sandbox:1.8.8` (Lab image, `scripts/lab-firmware`) | see `scripts/lab-firmware/Dockerfile.sandbox` |

Env overrides: `OPS_PRO_ESP32_IMAGE`, `OPS_PRO_PY_IMAGE`, `OPS_LAB_DOCKER`. Without an image the tool returns `status: pending`.

Run flags (pinned by a test): `--network none --read-only --cap-drop ALL --security-opt no-new-privileges --user 65534 --pids-limit 256 --memory 1g --cpus 2`, tmpfs `/work` (512 MB for ESP32). The core is baked in, so no network is needed at run time. Nano compiles as `arduino:avr:uno` (same ATmega328P).

Toolchain: arduino-cli 1.5.1, esp32:esp32 3.3.12 (arduino-esp32 on ESP-IDF 5.x), AVR as in the Lab. No extra libraries are installed (WiFi, Wire, SPI, etc. are in the core); a sketch that includes PubSubClient or a sensor library fails to compile until that library is added to Dockerfile.esp32 with a pinned version.

## Measurement spike (2026-10-23, Apple silicon, Colima, linux/arm64)

| Item | Result |
|---|---|
| esp32 image | 1.85 GB uncompressed (all chip toolchains: xtensa and riscv gcc, p4 libs) |
| python image | 18.5 MB |
| esp32 image cold build (network) | 27 min 46 s, nearly all core download |
| esp32 blink, fresh container | 6.4 s (257 KB bin) |
| esp32s3 blink | 7.3 s (289 KB bin) |
| esp32 with WiFi.h | 15.0 s (863 KB bin) |
| uno empty sketch | 0.8 s |
| python lint | 0.16 s |

Every run is a fresh container with an empty tmpfs, so these are cold-build times (no ccache). Wall clocks in code: esp32 60 s, avr 20 s, python 10 s. The 4 MB artifact cap fits (WiFi sketch is 0.86 MB). Prod is x86_64 and not measured; expect similar or faster. Slimming option if the image size matters: install only esp32 and esp32s3 tool packages by hand instead of the full core index (not done).
