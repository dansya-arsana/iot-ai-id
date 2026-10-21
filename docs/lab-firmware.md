# Lab firmware

The public `/lab` runs real ATmega328P firmware in avr8js. The firmware is compiled ahead of time from the original sketches in `apps/web/src/lab/firmware/sketches/<lesson>-<variant>/` and committed as data in `apps/web/src/lab/firmware/generated.ts` (flash image as base64, per-param patch offsets, DWARF line table, sha256 of the source). `npm run build` never needs a toolchain.

## Regenerate

```
npm run lab:firmware
```

Run it after any `.ino` change. `tests/lab-firmware.test.ts` fails with "run npm run lab:firmware" when a sketch no longer matches its recorded sha256.

Toolchain selection, in order:

1. Native. If `LAB_AVR_BIN` is set (a directory holding `avr-gcc`, `avr-objdump`, ...) it is passed as `compiler.path`. If unset, arduino-cli's own bundled avr-gcc is used when it runs (Linux, Intel Mac, Rosetta). On Apple Silicon without Rosetta, a native option is `brew tap osx-cross/avr && brew install avr-gcc@9`, then symlink the tools into one directory and point `LAB_AVR_BIN` at it.
2. Docker fallback. If the native probe fails (or `LAB_DOCKER=1`), the script uses the image `aiot-avr:1.8.8` (override with `LAB_DOCKER_IMAGE`), building it from `scripts/lab-firmware/Dockerfile` when missing (debian bookworm, arduino-cli, `arduino:avr@1.8.8`, Servo). arduino-cli and avr-objdump run inside the container with `.runtime/lab-fw` mounted, so the repo must live under a path Docker can mount (for Colima: under `$HOME`).

Never hand-write hex, use online compilers or commit placeholder firmware.

## Why -fno-lto and patching

Numeric params are top-level non-const globals with a literal initialiser. With LTO disabled the compiler keeps them as plain `.data` initialiser bytes in flash, so the UI can change a value by overwriting those bytes (`offset` in the registry) with no compiler in the browser. Each build verifies this: it compiles the default and a different value, requires the difference to be exactly the param's little-endian bytes, then compiles the max (or min) and requires the patched default image to be byte-identical to the freshly compiled image. Probe values are never zero, because a zero initialiser moves a variable to `.bss` and changes the layout; patching a param to 0 at runtime still works since startup copies the patched bytes into RAM. Structural choices (button hold or toggle, scale or alarm) are separate variants compiled on their own.

## Licensing

The images contain object code of ArduinoCore-avr, including its `Wire` library used by lessons 13 and 15 (LGPL-2.1, github.com/arduino/ArduinoCore-avr) and the Servo library (LGPL-2.1, github.com/arduino-libraries/Servo). Our sketches and the build script are in the repo, so anyone can rebuild and relink the images. arduino-cli is a build-time tool only; no GPL code is in the web bundle.

## Add a lesson or variant

1. Add the lesson/variant and its params to `FIRMWARE_SPEC` in `apps/web/src/lab/contract.ts`.
2. Write `sketches/<lesson>-<variant>/<lesson>-<variant>.ino`: `Serial.begin(9600)`, a ready line in `setup`, each param declared once as a non-zero, non-const global (`byte` for uint8, `unsigned int` for uint16) equal to its default.
3. Run `npm run lab:firmware` and `npx tsx --test tests/lab-firmware.test.ts`.

## AI-generated firmware (Lab AI builder)

The AI builder compiles sketches at request time, not at build time, so the committed `generated.ts` is not involved. Sketches go through `services/ops/lab-compile.ts`, which runs `arduino-cli` in a one-shot sandbox container (`aiot-avr-sandbox:1.8.8`, built from `scripts/lab-firmware/Dockerfile.sandbox` on top of `aiot-avr:1.8.8`): no network, read-only root, tmpfs work dir, unprivileged user, pids/memory/cpu limits, 20 s timeout, 20 KB source cap. The result has the same shape as a `FirmwareVariant` (base64 flash, sha256, DWARF line map), so the runner and the code view use it unchanged.

The three curated examples under `apps/web/src/lab/ai/examples/*.json` are precompiled with `npx tsx scripts/build-lab-examples.ts` (needs the sandbox image; never hand-edit the JSON). Rebuild them after changing a sketch in that script or in `circuit-examples.ts`.

Simulator note for generated sketches: a button is wired pin 1 to 5V, pin 2 to the digital pin with a 10k pull-down, read with plain `INPUT`; `INPUT_PULLUP` buttons do not work in the simulator.

### Deploy needs (owner)
- The ops image needs the Docker CLI plus a restricted socket proxy (never mount the host socket directly), or a compiler wrapper (`OPS_LAB_DOCKER`). The images are built on that host (commands in ADR 011, owner checklist). Without it only the examples work and builds answer 503 `compiler not configured`.
- Env: `OPS_API_INTERNAL_TOKEN` (same value in the ops and api env files), `IOT_API_INTERNAL_URL`, optional `OPS_LAB_IMAGE`, `OPS_LAB_AI_MEMBER_QUOTA`, `OPS_LAB_AI_GLOBAL_CAP`. The api and ops must share the `ops` docker network (already so).
- nginx: add the rate-limited `/ops/v1/lab/` and `/ops/v1/member/lab/` locations (GET and POST). `/internal` is never proxied; `/api` stays 403 on iot.ai.id.
