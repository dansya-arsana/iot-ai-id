# Extending the lab: add a component, a simulation or a lesson

Goal: adding a component is "spawn a sub-agent, add files, done". No core file is edited: not `contract.ts`, not `parts/index.ts`, not `layout.ts`, not `parts-copy.ts`, not the runner. Files dropped into two folders are discovered automatically.

## Architecture

A **kind** is one component type, identified by a kebab-case id such as `dht22`. It has three linked halves, joined only by that id:

| Half | File | Pure? | Job |
|---|---|---|---|
| Visual | `apps/web/src/lab/scene/parts/<kind>.ts` | three.js | `PartModule`: `build()` the 3D body, pins and anchors, `callouts`, `apply(group,state)` to show state |
| Simulation | `apps/web/src/lab/sim/devices/<kind>.ts` | no DOM, no three | `DeviceDef`: pins, typed `inputs`, `create(ctx)` returning a `DeviceModel` with hooks |
| Copy | `copy` in the device (builtin kinds keep theirs in `parts-copy.ts`) | data | name, description and note in English and Indonesian |

Discovery: `scene/parts/index.ts` and `sim/devices/index.ts` use `import.meta.glob` (Vite) and a synchronous `readdir`+`require` fallback (Node, tsx, tests, the ops server). Registering a device also publishes its `pins`, `holes`, `bodyX` and `copy` into `PART_PINS`, `PIN_COLS`, `BODY_X` and `PARTS_COPY`, which is what the CircuitSpec validator, the breadboard layout, the components panel and the AI builder read. The popover is generated from the device's `inputs` schema when the part does not declare its own controls.

```
apps/web/src/lab/
  contract.ts            shared types. PartKind is just a string; plugin state/input travel as {kind:'ext',type,v}
  sim/
    machine.ts runner.ts pins.ts peripherals.ts   avr8js board, runner, pin monitor, createModels (adapter over devices)
    devices/
      types.ts           the plugin API (read this first)
      index.ts           registry + auto-discovery + createDevice
      core/              host adapter, pulse scheduler, TWI bus, discovery helpers
      <kind>.ts          one DeviceDef per kind (led.ts ... dht22.ts)
  scene/parts/
    index.ts             registry + auto-discovery + buildPart
    kit.ts               geometry helpers, definePart, controlsFromInputs, extState
    types.ts             PartModule
    <kind>.ts            one PartModule per kind
  firmware/sketches/<lesson>-<variant>/   .ino sources; npm run lab:firmware builds generated.ts
  lessons.ts goals.ts    lesson text and goals (a lesson is data)
scripts/lab-new-part.ts  scaffolder
tests/lab-parts-contract.test.ts          checks EVERY registered kind
```

### The device plugin API (`sim/devices/types.ts`)

Time is CPU cycles (16 per microsecond). Use `us(n)` and `ms(n)`.

| Hook | When | Typical use |
|---|---|---|
| `onPinChange(pin,level,cycle)` | edge on a pin the device is wired to | trigger pulses, one-wire start, button-like inputs |
| `update(frame)` | once per simulated slice, with duty/frequency/high-pulse samples of every pin | LED, motor, buzzer, servo |
| `tick(cycles,now)` | once per slice (via the adapter) | time-driven behaviour |
| `adc()` returns `{pin,volts}` | polled after each slice and on input | potentiometer, LDR, any analog sensor |
| `ctx.drive(pin,[{level,holdCycles}...],{delayCycles,onDone})` | called from any hook | echo pulses, DHT22 response, any pulse train, cancellable |
| `ctx.line(pin)` + `ctx.hostDrives(pin)` + `ctx.pinLevel(pin)` | shared open-drain line | one-wire: the monitor then reports the effective level, including the MCU releasing the pin |
| `i2c: {address,onStart,onWrite,onRead,onStop}` | the sketch uses Wire | registers on the avr8js `AVRTWI` bus (created lazily, so other sketches are untouched) |
| `uart: {onTx(byte,cycle)}` and `ctx.uartSend(byte)` | the sketch uses Serial | taps TX, injects RX |
| `state()` | every frame | typed state for `PartModule.apply`; plugin kinds return a flat record of scalars |
| `inputs` (on the def) | popover | typed `range`/`toggle`/`choice` controls; each `key` is a PartProps key, popover edits arrive in `ctx.props` |

Driving a pin the sketch reads (a switch or sensor): `uno(ctx.net('SIG'))` (from `./core/util`) turns the wired board pin into a `UnoPin` or null, and `ctx.env.setPin(pin,level)` drives it. Popover edits only mutate `ctx.props`; nothing is called, so poll `ctx.props` in `tick()` and `state()` and call `setPin` on change (see `tilt-switch.ts`). The scaffolder's `switch` template does this.

Test notes: `createModels` copies the circuit spec's props, so in a test set `m.props.x=...` on the model, not on the spec. A `PartModel` has `update(f)` (not `tick`) and `f` needs `{samples,dtSec,cycles}`; `m.onEdge` only suits input-side devices. The scaffolded assertions are placeholders: replace them. The part's `pin(...)` type argument is one of `'power'|'ground'|'input'|'output'`. `docs/lab-parts/<kind>.md` carries a TODO list: delete it when done.

Read user edits from `ctx.props` lazily (when you need the value), not at create time: `runner.setPartProps` mutates that object.

Typed state in the scene: `extState<MyState>(state,'<kind>')` (from `parts/kit`) narrows a `PartState` to your device's state or returns `undefined`.

Footprint: `holes` gives the breadboard column offset of each pin, in pin order (omit for a desk prop); `bodyX` is the body's x extent in mm when it is wider than the legs.

## Add a new component (recommended: scaffold)

```
npm run lab:new-part -- <kind> --protocol gpio|adc|pwm|pulse|i2c|onewire|uart|switch [--desk] [--force]
```

It writes the device (from the protocol template), the part, `tests/lab-part-<kind>.test.ts` and `docs/lab-parts/<kind>.md`, and regenerates `docs/lab-parts/README.md`. The kind is registered the moment the files exist. Then:

1. Device: replace the template behaviour with the real one. Cite the datasheet timing in comments. Fill `copy` (English and Indonesian) and the `inputs`.
2. Part: replace the placeholder body with the real shape (see `scene/parts/dht22.ts`, `hcsr04.ts`). Colours come from `scene/palette.ts` (a new hex needs a `// ds-allow-hex` comment and a reason). Anchors in mm: x right, y up, z toward the viewer, origin at the first leg on the board.
3. Run `npx tsx --test tests/lab-parts-contract.test.ts tests/lab-part-<kind>.test.ts`.
4. Screenshot it (below).
5. `npm run check`.

Protocol templates:

| `--protocol` | Template shows | Real example in the repo |
|---|---|---|
| `gpio` | `onPinChange` on a digital pin (the sketch drives it, the part indicates) | `led.ts` |
| `switch` | the part drives a pin the sketch reads, from a popover toggle polled in `tick()` | `tilt-switch.ts`, `button.ts` |
| `adc` | `adc()` voltage on an analog pin, slider input | `potentiometer.ts`, `ldr.ts` |
| `pwm` | `update(frame)` reading duty/frequency | `led.ts`, `motor.ts`, `servo.ts`, `buzzer.ts` |
| `pulse` | trigger in, timed echo out with `ctx.drive` | `hcsr04.ts` |
| `i2c` | `i2c` slave at 0x40 with a register pointer | template only |
| `onewire` | shared line, reset and presence pulse with `ctx.line` | `dht22.ts` (full 40-bit protocol) |
| `uart` | `uart.onTx` tap and `ctx.uartSend` reply | template only |

## Add a lesson

A lesson is data plus a sketch; unlike a kind it does touch the tables that index lessons.

1. Sketch: `firmware/sketches/<id>-default/<id>-default.ino`. `Serial.begin(9600)`, a ready line in `setup()`, each tunable value a non-zero non-const global (see `docs/lab-firmware.md`). The first statement of `loop()` must generate code. Never use `micros()` for timeouts inside `noInterrupts()`: timer0 stops counting overflows and `micros()` can run backwards.
2. `contract.ts`: add the id to `LESSON_IDS`, a `CIRCUITS[id]` entry (parts and wires) and a `FIRMWARE_SPEC[id]` entry with the params.
3. `lessons.ts`: the lesson text, English and Indonesian (the test checks 3-5 callouts and walkthrough steps, and a 50-160 character SEO description). `goals.ts`: `GOALS` and `READOUTS`.
4. The per-lesson records the compiler will ask for: `ui/lesson-strip.tsx` (concept chip), `ui/analyzer.tsx` and `ui/test-record.tsx` (key pins), `scene/thumbnails.ts` (card subject), `ui/icons.tsx` (card icon).
5. `npm run lab:firmware` (needs Docker image `aiot-avr:1.8.8`, colima running) and commit the changed `generated.ts`.
6. Tests: `tests/lab-lessons.test.ts` count, an integration test that runs the real firmware (see `tests/lab-dht22.test.ts`), and an e2e spec.

## Testing

```
npx tsx --test tests/lab-parts-contract.test.ts          # every kind: build, pins, anchors, apply, copy en+id, inputs
npx tsx --test tests/lab-*.test.ts                        # all lab unit and integration tests
npm run check                                             # typecheck, lint, tokens, tests, build
npx playwright test                                       # all e2e (starts its own server on 8891)
```

Contract test failures name the kind and the rule. A good unit test of a device uses a fake `Env` (a clock with scheduled callbacks and pin logs; copy `tests/lab-part-<kind>.test.ts` from the scaffolder) and asserts exact cycle times, then one test boots the real firmware with `createLabRunner` and checks the serial text.

## Screenshots

```
npm run build
API_PORT=<port> API_BIND=127.0.0.1 IOT_AGENT_PROVIDER=fixture IOT_DB_PATH="$(mktemp -d)/x.sqlite" npx tsx services/api/server.ts &
```

Playwright chromium needs software GL: `launchOptions:{args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}`. Open `http://iot.admin.localhost:<port>/lab/<lesson>?e2e=1`, wait for `.lab[data-scene=ready]`, and use `window.__labScene.project(partId)` to click a part. See `tests/e2e/26-lab-dht22.spec.ts`. Save images outside the repo (the scratchpad) and kill your server when done. Do not use ports 5173 or 8787.

## IP rules

- Write the model and the sketch ourselves from the public datasheet behaviour. Do not copy vendor 3D models, product photos, logos or marketing art.
- No GPL or LGPL code in the web bundle or in lesson sketches: write the minimal reader yourself instead of pulling a vendor library (the DHT22 reader is ours). The only third-party firmware code is ArduinoCore-avr and Servo (LGPL, in the compiled images, see `docs/lab-firmware.md`).
- A new dependency needs a permissive licence (MIT, BSD, Apache-2.0, ISC) and an entry in `THIRD_PARTY_NOTICES.md`.
- State the provenance of the part in `docs/lab-parts/<kind>.md`.
- Never touch the physical-hardware safety model: parts and devices are simulation only; USB actions stay behind the human-approved trusted port.

## Sub-agent brief (paste this, fill the angle brackets)

```
Task: add the lab component "<kind>" (<what it is, e.g. DS18B20 temperature sensor, one-wire>).
Read first: docs/lab-extending.md, apps/web/src/lab/sim/devices/types.ts, and the closest example
(<dht22.ts for one-wire | hcsr04.ts for pulse | potentiometer.ts for adc | led.ts for pwm>).

Do:
1. npm run lab:new-part -- <kind> --protocol <protocol>
2. Implement the real behaviour in apps/web/src/lab/sim/devices/<kind>.ts from the datasheet (<link or key timings>). Typed state, typed inputs, copy in English and Indonesian.
3. Model the 3D body in apps/web/src/lab/scene/parts/<kind>.ts (<describe the look>). Pins and anchors must match the device's pins.
4. Fill tests/lab-part-<kind>.test.ts with exact-timing assertions, and add a real-firmware test if a sketch is involved.
5. Run: npx tsx --test tests/lab-parts-contract.test.ts tests/lab-part-<kind>.test.ts && npm run typecheck && npm run lint

Own only these files: the four created by the scaffolder (device, part, test, docs page) and, if asked, one lesson.
Do not edit: contract.ts, scene/parts/index.ts, scene/parts/kit.ts, sim/*.ts outside sim/devices/<kind>.ts, layout.ts, parts-copy.ts, any other kind, deploy/*.
Rules: write everything yourself, no vendor models or GPL code; keep the simulation honest (no faked values); do not commit.
Report: STATUS, files changed, test output, one screenshot path.
```
