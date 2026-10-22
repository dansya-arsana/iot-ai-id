# Extending the lab: add a component, a simulation or a lesson

Goal: adding a component or a lesson is "spawn a sub-agent, add files, done". No core file is edited: not `contract.ts`, not `parts/index.ts`, not `layout.ts`, not `parts-copy.ts`, not the runner, not a lesson table. Files dropped into four folders are discovered automatically, so any number of agents can work in parallel (see "Parallel-safe workflow").

## Architecture

A **kind** is one component type, identified by a kebab-case id such as `dht22`. It has three linked halves, joined only by that id:

| Half | File | Pure? | Job |
|---|---|---|---|
| Visual | `apps/web/src/lab/scene/parts/<kind>.ts` | three.js | `PartModule`: `build()` the 3D body, pins and anchors, `callouts`, `apply(group,state)` to show state |
| Simulation | `apps/web/src/lab/sim/devices/<kind>.ts` | no DOM, no three | `DeviceDef`: pins, typed `inputs`, `create(ctx)` returning a `DeviceModel` with hooks |
| Copy | `copy` in the device (builtin kinds keep theirs in `parts-copy.ts`) | data | name, description and note in English and Indonesian |

A **lesson** is one file `lessons/<id>.ts` (text, circuit, firmware spec, goal, readouts, card data) plus its sketch folder and its generated firmware file.

Discovery: `scene/parts/index.ts`, `sim/devices/index.ts`, `lessons/index.ts` and `firmware/index.ts` use `import.meta.glob` (Vite) and a synchronous `readdir`+`require` fallback (Node, tsx, tests, the ops server). Registering a device also publishes its `pins`, `holes`, `bodyX` and `copy` into `PART_PINS`, `PIN_COLS`, `BODY_X` and `PARTS_COPY`, which is what the CircuitSpec validator, the breadboard layout, the components panel and the AI builder read. Registering a lesson fills `LESSON_IDS`, `CIRCUITS`, `FIRMWARE_SPEC` (re-exported by `contract.ts`), `GOALS`, `READOUTS`, `LESSONS`. The popover is generated from the device's `inputs` schema when the part does not declare its own controls.

```
apps/web/src/lab/
  contract.ts            shared types. PartKind is just a string; plugin state/input travel as {kind:'ext',type,v}. Circuit = parts + wires + links + board
  boards.ts              board variants (uno, nano run; esp32 is model only), BoardDef, boardOf()
  constants.ts           plain constants lesson files may import at runtime
  sim/
    machine.ts runner.ts pins.ts peripherals.ts   avr8js board, runner, pin monitor, createModels/createWorldModels
    power.ts             PowerNetwork: net voltages, supplies, regulators, checkPower() warnings (pure, shared with the validator)
    world.ts             World: part-to-part nets (peers), volts(), supply(), notes() for one loaded circuit
    devices/
      types.ts           the plugin API (read this first)
      index.ts           registry + auto-discovery + createDevice
      core/              host adapter, pulse scheduler, TWI bus, SPI bus (spi.ts), bit-bang helpers (bitbang.ts)
      <kind>.ts          one DeviceDef per kind (led.ts ... dht22.ts, lm7805.ts)
  scene/parts/
    index.ts             registry + auto-discovery + buildPart
    kit.ts               geometry helpers, definePart, controlsFromInputs, extState
    types.ts             PartModule, ControlSpec, Grab (3D direct manipulation)
    demo.ts              hover demos of the parts gallery (see "Gallery demos")
    <kind>.ts            one PartModule per kind
  scene/board-uno.ts board-nano.ts   the two runnable boards (same UnoBuild interface, swapped per Circuit.board)
  lessons/
    index.ts kit.ts      registry and the lesson kit (defineLesson, circuit and goal helpers)
    <id>.ts              ONE file per lesson, ordered by its numeric `order`
  firmware/
    sketches/<lesson>-<variant>/   .ino sources
    generated/<sketch>.ts          compiled output, one file per sketch (written by npm run lab:firmware -- <sketch>)
    index.ts                       assembles labFirmware from generated/
  lessons.ts goals.ts    thin shims over the lesson registry (old import paths keep working)
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
| `spi: {cs,activeLow,onSelect(selected,cycle),onTransfer(mosi,info):miso}` | the sketch uses SPI (SPDR or SPI.transfer) | registers on the avr8js `AVRSPI` master (lazy). See "SPI" below |
| `new TwoWireSlave(ctx,cfg,handlers)`, `new Ws2812Decoder(opts)` (from `core/bitbang`) | custom clocked buses, WS2812 | decode cycle-stamped edges you forward from `onPinChange`. See "Bit-bang buses" below |
| `output(pin)` returns `{volts,ohms?}` or null | the part drives a voltage on one of its pins | L298N OUT1..OUT4; a linked part reads it with `ctx.volts()` |
| `switches()` returns `[{a,b,closed}]` | the part has a contact | relay COM-NO / COM-NC; the net solver merges the nets of a closed contact |
| `ctx.peers(pin)`, `ctx.volts(pin)`, `ctx.supply()`, `ctx.analogPin(name)` | part-to-part wires, power | see "Part-to-part nets" and "Power" below |
| `state()` | every frame | typed state for `PartModule.apply`; plugin kinds return a flat record of scalars |
| `power`, `supplies(props)`, `regulators(props)` (on the def) | supply rating, sources, regulators | see "Power" below |
| `inputs` (on the def) | popover | typed `range`/`toggle`/`choice` controls; each `key` is a PartProps key, popover edits arrive in `ctx.props` |

Driving a pin the sketch reads (a switch or sensor): `uno(ctx.net('SIG'))` (from `./core/util`) turns the wired board pin into a `UnoPin` or null, and `ctx.env.setPin(pin,level)` drives it. Popover edits only mutate `ctx.props`; nothing is called, so poll `ctx.props` in `tick()` and `state()` and call `setPin` on change (see `tilt-switch.ts`). The scaffolder's `switch` template does this.

Test notes: `createModels` copies the circuit spec's props, so in a test set `m.props.x=...` on the model, not on the spec. A `PartModel` has `update(f)` (not `tick`) and `f` needs `{samples,dtSec,cycles}`; `m.onEdge` only suits input-side devices. The scaffolded assertions are placeholders: replace them. The part's `pin(...)` type argument is one of `'power'|'ground'|'input'|'output'`. `docs/lab-parts/<kind>.md` carries a TODO list: delete it when done.

Read user edits from `ctx.props` lazily (when you need the value), not at create time: `runner.setPartProps` mutates that object.

Typed state in the scene: `extState<MyState>(state,'<kind>')` (from `parts/kit`) narrows a `PartState` to your device's state or returns `undefined`.

Footprint: `holes` gives the breadboard column offset of each pin, in pin order (omit for a desk prop); `bodyX` is the body's x extent in mm when it is wider than the legs. The layout reserves breadboard columns for a body that reaches more than 5 mm left or 6 mm right of its legs (PIR, relay, LCD...), so neighbours never hide it; a body wider than the free lanes goes to the back lane. A part spec may carry `lane:'front'` (on-board parts: use the lane facing the camera) or, for a desk prop, `deskX` (centre in mm, to keep a tall battery or relay board clear of the Uno). Popover inputs of type `choice` may set `momentaryMs` (a tap that releases itself, like keypad keys) and `fold` (same title = one collapsed disclosure). The layout also keeps the measured right edge of the last body in each lane (from `bodyX`, 0.5 mm clear), so give `bodyX` honestly: it is what keeps a neighbour from overlapping the part. A module that cannot fit in the lane (a driver with a long body) may hang over the end of the breadboard; its legs stay in the strip. Two lanes only: a lesson can hold about four wide modules, so fold per-pin resistors into a popover input instead of seven resistor parts (see the seven-segment `seriesOhms`).

## Direct manipulation in 3D, terminals and the layout guard

* **Grabs.** A mesh or group of a part may carry `userData.grab` (type `Grab` in `scene/parts/types.ts`): `{type:'tap',key,value,rest,ms}` (a click taps one value, like a keypad key: set, then back to `rest` after `ms`), `{type:'stick',x,y,max,travelPx}` (drag tilts a thumb stick; it springs back on release) and `{type:'knob',key,min,max,perTurn}` (drag round it to turn it). The picking layer finds the grab under the pointer and calls `InteractiveHandlers.onControl(partId,key,value)`, which the page routes exactly like a popover edit, so the 3D gesture and the popover always agree and every `key` is a key of the device `inputs`. A plain click on a stick or knob still pushes its switch (a button input) and a click on any part still opens its popover. `scene.grabPoints(partId)` returns screen points of the pieces for tests.
* **Terminal input.** `{type:'terminal',key,label,placeholder,input,log,ending?}` in a device's `inputs` renders a text terminal in the popover: `log` names the state field with the transcript (one row per line, `< ` from the sketch, `> ` from the user), Send delivers `{kind:'ext',type:input,v:{line,ending}}` to the model's `setInput`. The HC-05 uses it.
* **Layout guard.** `scene.layoutReport()` (only with `?e2e=1`) returns per-mesh boxes of the board and every part, display glass planes (a mesh with `userData.glass=true`: mark the window of a display part) and the centre line of every jumper. `tests/e2e/29-lab-layout.spec.ts` walks EVERY lesson file and fails on overlapping parts or part-on-Uno, a jumper drawn in front of a display's glass in the lesson camera, or a part whose hotspot is hidden. A part and its `props.target` (stepper in its driver, bulb on its relay) may touch. A lesson that fails: give a part `lane:'front'`, a `deskX`, a `view`, or fix the part's `bodyX`.
* **Where a jumper ends.** On the pin's hole when the placed part stands on the breadboard (`Placement.onBoard`) and the pin has a hole; otherwise at the pin's own 3D anchor (desk modules, screw terminals, header pins of an off-board module). Decided from the placement, not the kind.

## Gallery demos and the Test Record

* `/lab/parts` cards come alive on hover (`scene/parts/demo.ts`): the real device model runs on a fake clock while the popover `inputs` are swept (ranges glide, toggles flip, momentary choices tap); output-only builtins (LED, buzzer, motor, servo) and displays that a sketch would fill have a state table (`STATIC`, `DISPLAY`). `/lab/parts/<kind>` also has a "Try it" popover bound to the same model, with no sketch running. Add a `DISPLAY` entry when a new display kind should show a pattern.
* The runner's snapshot carries `bus` (`BusStats`): UART bytes, lines and baud, SPI transactions, bytes, mode and clock, I2C transactions, addresses and NACKs. The generic Test Record (`ui/test-record.tsx`) picks the row from the protocol of the part wired to each record pin (UART, SPI, I2C, WS2812 frames and pixels), so a new lesson needs no `CUSTOM_RECORDS` entry for its buses.
* e2e specs wait in **simulated** time: `tests/e2e/lab-sim.ts` (`untilSim`, `waitSim`, `serialHas`, `goalDone`, `hookSnapshot`). A budget of N simulated ms is the same on every machine; wall clock only caps a stalled simulation.

## Buses and protocols

### SPI

The ATmega328P SPI master (avr8js `AVRSPI`) is created the first time a device declares `spi`, so sketches without SPI run exactly as before. Declare a slave on the model:

```ts
interface SpiSlave{
 cs?:string;                 // part pin name that carries chip select; omit = always selected
 activeLow?:boolean;         // default true
 onSelect?(selected:boolean,cycle:number):void;   // CS edge: reset your command state here
 onTransfer(mosi:number,info:SpiInfo):number;     // one byte; return what you shift out on MISO
}
interface SpiInfo{mode:0|1|2|3;lsbFirst:boolean;clockHz:number;cycle:number;index:number} // index 0 = first byte after CS went active
```

How it behaves: a byte is delivered at the start of the transfer, and the reply (MISO) reaches `SPDR` when the real transfer time (clock divider x 8 cycles) has elapsed. CS is whatever pin the sketch drives (`digitalWrite`); a CS pin the sketch never makes an output floats high, so the device is not selected. With no selected slave the master reads 0xFF. SCK pulses on D13 for the length of each byte, so the analyzer shows the traffic. SCK, MOSI, MISO are the fixed pins D13, D11, D12: wire them in the circuit (CircuitSpec) but only CS is looked up (`pins` should list SCK, MOSI, MISO, CS in module order). `sketchPins()` treats `SPI.begin/transfer/beginTransaction` as using D11-D13.

Scaffold: `npm run lab:new-part -- <kind> --protocol spi`. Real example: the test device in `tests/lab-bus.test.ts` with `tests/fixtures/sketches/spi-id.ino`.

### Bit-bang buses (`sim/devices/core/bitbang.ts`)

For buses with no hardware peripheral. You forward the device's edges and read bytes or bits.

```ts
class TwoWireSlave{
 constructor(ctx:DeviceCtx,cfg:TwoWireConfig,h?:TwoWireHandlers)
 edge(pin:UnoPin,level:Level,cycle:number):void       // call from onPinChange
 shiftOut(bits:readonly number[],o?:{on?:'rising'|'falling';done?:(cycle:number)=>void}):void  // slave -> master, one bit per clock edge
 pull(low:boolean):void                               // hold DIO low (HX711 "ready") or release
 cancelShift():void;  readonly holdingLow:boolean;  starts;stops;bytes;clockEdges  // counters
}
interface TwoWireConfig{clk:string;data:string;lsbFirst?:boolean;bits?:number;framing?:'start-stop'|'free';ack?:boolean}
interface TwoWireHandlers{onStart?(cycle);onByte?(byte,cycle):boolean|void;onStop?(cycle)}   // onByte false = NACK
```

* `framing:'start-stop'` (default) is the TM1637/I2C shape: DIO falling while CLK is high is START, rising while CLK is high is STOP, bytes are sampled on CLK rising (LSB first unless `lsbFirst:false`). `ack:true` drives the ACK low pulse from the falling edge of the 8th clock to the falling edge of the 9th.
* `framing:'free'` has no framing (shift registers, HX711): use `shiftOut`. HX711: `bus.pull(true)` when a conversion is ready, `bus.shiftOut(bits24,{on:'rising',done:()=>bus.pull(false)})`; the 25th pulse releases the line (gain 128).
* The data line is an open-drain shared line: the constructor calls `ctx.line()`; the monitor reports the effective level including the MCU releasing the pin.
* Pin levels the monitor starts with are all 0; the first clock edge a sketch makes (usually a rise to idle-high) is seen as an edge and ignored outside a frame.

```ts
class Ws2812Decoder{
 constructor(o:{schedule(cycles,cb):void;onFrame(f:Ws2812Frame):void;count?:number;resetUs?:number;order?:'GRB'|'RGB'|'BRG'})
 edge(level:Level,cycle:number):void
 frames;totalBits;totalErrors
}
interface Ws2812Frame{pixels:[number,number,number][];bits:number;timingErrors:number;cycle:number}   // pixels are [r,g,b] 0-255
```

A bit is read from the width of the high pulse (below 0.6 us = 0, above = 1; datasheet T0H 0.4 us, T1H 0.8 us, each +-150 ns: other widths count in `timingErrors`). A low of `resetUs` (50 us, 280 for the V5 parts) latches the frame; it is also latched when the line simply stays low after the last bit (a scheduled check, `schedule` = `ctx.schedule`). `count` keeps only the first N LEDs, like a real chain whose first LED eats the first 24 bits and passes the rest on. A sketch must keep interrupts off (`noInterrupts()`) while it sends: timer0 would stretch a pulse.

Scaffolds: `--protocol twowire` (TM1637 style), `--protocol ws2812`. Fixtures that run real firmware through these helpers: `tests/lab-bus.test.ts`.

To compile a fixture sketch: `npm run lab:firmware -- --raw tests/fixtures/sketches/x.ino tests/fixtures/firmware/x.json [--board nano]` (Docker image `aiot-avr:1.8.8`, colima running); load it with `createLabRunner().load(fx.variant,{},circuit,fx.toolchain)`.

## Part-to-part nets

A wire may join two part pins, not only a part pin and a board pin. In a CircuitSpec just write `{from:'drv.OUT1',to:'m1.+'}`; `specToCircuit` turns every wire without a board end into `Circuit.links` (`{a:{part,pin},b:{part,pin},color}`). Pins joined this way have no entry in `PartSpec.net` (unless they also reach a board pin). The 3D scene draws a jumper between the two pin anchors (a pin that plugs into the breadboard ends at its hole, a screw terminal or a desk part at its own anchor); links are drawn after the board wires and the build steps address them like any wire.

Devices see the other end through the context:

```ts
ctx.peers(pin):readonly {part,kind,pin}[]   // other part pins on the same net (links and shared board pins), never the pin itself
ctx.volts(pin):number|null                  // voltage of that net: rails, supplies, regulators and the output() of linked parts; null = floating
ctx.supply():number|null                    // voltage across def.power.rail, or null when not wired
// on the model:
output?(pin:string):{volts:number;ohms?:number}|null   // what THIS part drives on its pin (null = high impedance)
switches?():readonly {a:string;b:string;closed:boolean}[] // contacts: a closed one merges the nets of its two pins
```

Terminals: a pin without a hole is wires only. `holes` may be shorter than `pins` (the first N pins plug into the breadboard, the rest are screw terminals): the L298N has a seven-pin logic header plus OUT1-4, VS, V5. Give every pin a 3D anchor (the contract test checks it).

Working examples: `l298n.ts` drives `motor.ts` through OUT1/OUT2 (average voltage = EN duty x IN duty x (VS - 2 V); EN low floats the outputs = coast, equal inputs = brake; negative volts = reverse, shown as negative rpm), `relay-module.ts` switches `load-lamp.ts` through COM/NO. Both are exercised in `tests/lab-nets.test.ts`. A device reads the world in `update()`; the solver re-solves after every device update, so a linked part can lag one slice (at most 1 ms in `advance()`, 16 ms in the browser).

## Power

`sim/power.ts` is a simple DC solver. Nets (groups of board pins and part pins) get one voltage each:

* board rails are ideal: GND 0 V, 5V 5 V, 3V3 3.3 V; a pin the sketch drives is a weak source (duty x 5 V, 25 ohm); VIN sits near 4.7 V (USB through the input diode) unless a supply feeds it;
* a **supply** declares `{pos,neg,volts,maxMa?}` (`supplies(props)` on the def: battery-9v, battery-aa-4); `V(pos)=V(neg)+volts`, and a supply nothing else references floats with its minus at 0 V;
* a **regulator** declares `{in,out,gnd,volts,dropout}` (`regulators(props)`: lm7805 5 V/2 V, ams1117-3v3 3.3 V/1.1 V, breadboard-power's two rails): `out = min(volts, in - dropout)` above `gnd`; a part below its dropout is reported;
* a part can **drive** a pin (`output()`), the lowest `ohms` on a net wins; two ideal sources of different voltage on one net, or a supply whose two ends are already fixed to a different voltage, is a short.

A part declares what it needs with `power:{rail:[pos,neg],min,max,ma?,external?}` on its def. `checkPower()` then produces friendly bilingual notes: `over` (error: a 3.3 V part on 5 V), `under`, `external` (a motor-like load on a board pin or I/O pin), `conflict`, `dropout`. The same function runs in the live simulator (`snapshot.power`, shown as a notice on the stage and refreshed about every 100 ms of simulated time) and in `validateCircuitSpec` (issue codes `power-over`, `power-under`, `power-external`, `power-conflict`, `power-dropout`, all warnings, so the AI builder sees them). Scaffold the rating with `--power 3.3-5.5`.

Battery parts are real supplies: wire PLUS to VIN (or to a driver's VS or a regulator's IN) and MINUS to GND. The board is always powered by USB in the simulation, so VIN only matters to other parts.

## Boards

`Circuit.board` (CircuitSpec `board:'uno'|'nano'`, default 'uno') picks the board. Both run the same emulated ATmega328P; the Nano swaps in `scene/board-nano.ts` (43 x 18 mm, two 15-pin rows, mini-USB, no barrel jack), says NANO in the header and adds **A6 and A7: analog input only** (no port bit, no digital function, no pull-up). Use `ctx.analogPin(name)` (not `ctx.pin`) for an `adc()` pin so a sensor can sit on A6/A7; the validator rejects A6/A7 on a Uno circuit and `pinMode/digitalRead/digitalWrite` on them. A lesson that needs the Nano core (`A6` defined) sets `board:'nano'` on its variant in `firmware.variants` (compiled with `arduino:avr:nano:cpu=atmega328`); on the Uno core, `analogRead(6)` works too. The AI builder compiles with the Uno core (same chip, so use plain numbers 6 and 7 for A6/A7).

The ESP32 stays a **model only**: another CPU that avr8js cannot run. Its device has `runtime:'not-emulated'`, the popover says so and `createLabRunner().load()` throws for `board:'esp32'`. Do not clear that flag unless a real emulator is added.

## Add a new component (recommended: scaffold)

```
npm run lab:new-part -- <kind> --protocol gpio|adc|pwm|pulse|i2c|onewire|uart|switch|spi|twowire|ws2812 [--desk] [--power 3.3-5.5] [--force]
```

It writes the device (from the protocol template), the part, `tests/lab-part-<kind>.test.ts` and `docs/lab-parts/<kind>.md`, and regenerates `docs/lab-parts/README.md`. The kind is registered the moment the files exist. Then:

1. Device: replace the template behaviour with the real one. Cite the datasheet timing in comments. Fill `copy` (English and Indonesian) and the `inputs`. Add `power` (the supply rating) when the datasheet gives one.
2. Part: replace the placeholder body with the real shape (see `scene/parts/dht22.ts`, `hcsr04.ts`). Colours come from `scene/palette.ts` (a new hex needs a `// ds-allow-hex` comment and a reason). Anchors in mm: x right, y up, z toward the viewer, origin at the first leg on the board. Every pin in `pins` needs an anchor, terminals included.
3. Run `npx tsx --test tests/lab-parts-contract.test.ts tests/lab-part-<kind>.test.ts`.
4. Screenshot it (below).
5. `npm run check`.

Protocol templates:

| `--protocol` | Template shows | Real example in the repo |
|---|---|---|
| `gpio` | `onPinChange` on a digital pin (the sketch drives it, the part indicates) | `led.ts` |
| `switch` | the part drives a pin the sketch reads, from a popover toggle polled in `tick()` | `tilt-switch.ts`, `button.ts` |
| `adc` | `adc()` voltage on an analog pin (`ctx.analogPin`, so A6/A7 work), slider input | `potentiometer.ts`, `ldr.ts` |
| `pwm` | `update(frame)` reading duty/frequency | `led.ts`, `motor.ts`, `servo.ts`, `buzzer.ts` |
| `pulse` | trigger in, timed echo out with `ctx.drive` | `hcsr04.ts` |
| `i2c` | `i2c` slave at 0x40 with a register pointer | `bme280.ts`, `lcd1602-i2c.ts` |
| `onewire` | shared line, reset and presence pulse with `ctx.line` | `dht22.ts` (full 40-bit protocol) |
| `uart` | `uart.onTx` tap and `ctx.uartSend` reply | template only |
| `spi` | `spi` slave with chip select, command byte then data with auto-increment | test device in `tests/lab-bus.test.ts` |
| `twowire` | `TwoWireSlave`: START/STOP, LSB-first bytes, ACK on the 9th clock | test device in `tests/lab-bus.test.ts` |
| `ws2812` | `Ws2812Decoder`: GRB pixels from 800 kHz edges, state shows the LED colours | test device in `tests/lab-bus.test.ts` |

Power parts (regulators, supplies) use the `gpio` template with no signal pins: see `lm7805.ts`, `ams1117-3v3.ts`, `breadboard-power.ts`, `battery-9v.ts` and `tests/lab-part-lm7805.test.ts`. A part with a contact (relay) implements `switches()`; a part that drives a voltage (bridge, source) implements `output()`.

## Add a lesson

A lesson is ONE file plus its sketch and its generated firmware. You do not edit any shared table.

1. Sketch: `firmware/sketches/<id>-default/<id>-default.ino`. `Serial.begin(9600)`, a ready line in `setup()`, each tunable value a non-zero non-const global (see `docs/lab-firmware.md`). The first statement of `loop()` must generate code. Never use `micros()` for timeouts inside `noInterrupts()`: timer0 stops counting overflows and `micros()` can run backwards. No GPL/LGPL libraries beyond the Arduino core, Wire and Servo that already ship: write minimal drivers yourself.
2. Lesson module `apps/web/src/lab/lessons/<id>.ts`:

```ts
import {defineLesson,c,co,pinRow,sp,b,w,P,RAILS,ledOn,changes,byKind,pill,idOf} from './kit';
export const lesson=defineLesson({
 id:'<id>',order:170,                        // numeric: lessons are numbered 1..N by ascending order; leave gaps
 concept:'SPI',keyPins:['D10','D13'],recordPins:['D10'],   // card chip, analyzer lanes (key first), pins the test record quotes
 circuit:{parts:[...],wires:[w('x1','SIG','D10','yellow'),...RAILS],links:[...]},   // links = part-to-part wires, board:'nano' optional
 firmware:{variants:[{id:'default',params:[P('readEvery','uint16',500,100,2000,100)]}]},
 check:(s,m)=>...,                           // the goal: true once the learner did it; m is memory across frames
 readouts:s=>[pill(id,'text')],              // optional pills next to parts while running
 icon:['M5 9h22v14H5z'],                     // optional SVG path data (32x32); else the built-in icon of that id, else a chip
 thumbnail:[{kind:'bme280',x:0}],            // optional card picture (default: first two non-passive parts), or 'uno'
 view:{az:32,elev:34,board:true},            // optional camera (default: the 'blink' view)
 title:c('...','...'),tagline:...,overview:...,pinout:[pinRow(...)],walkthrough:[...],specs:[...],callouts:[co(...)],params:{...},goal:{text:...,hint:...},seo:{title:'...',description:'50-160 characters'},
});
```

   `kit.ts` holds the helpers (`c`, `co`, `pinRow`, `sp`, `b`, `w`, `ledOn`, `sonar`, `RAILS`, `P`, and the goal helpers `byKind`, `extOf`, `changes`, `range`, `pill`...). Copy a similar lesson (`lessons/dht.ts`, `oled.ts`, `plant.ts`) and edit it. The tests check 3-5 callouts, 3-5 walkthrough steps, English and Indonesian everywhere and the SEO length.
3. Compile only your sketch: `npm run lab:firmware -- <id>-default` (or `-- <id>` for all its variants). It writes `firmware/generated/<id>-default.ts` and touches nothing else. Needs Docker image `aiot-avr:1.8.8` with colima running; commit the generated file. Every run works in its own folder `.runtime/lab-fw/run-<pid>-<time>` (removed on exit), so two builds at once do not collide, and a transient colima mount failure is retried with exponential backoff.
4. Tests: an integration test that runs the real firmware (see `tests/lab-dht22.test.ts`, `tests/lab-lessons-13-16.test.ts`), and an e2e spec (`tests/e2e/27-lab-lessons-13-16.spec.ts` shows how to read part states from the live snapshot by wrapping `window.__labScene.update`). `tests/lab-lesson-modules.test.ts` already checks that every lesson has its generated file and that the generated source equals the sketch on disk.

A lesson that needs a record on the Test Record panel beyond the generic one (a decoded value, an echo) cannot add one without editing `ui/test-record.tsx` (`CUSTOM_RECORDS`): ask the owner of the core instead of editing it in a parallel branch. The generic record already speaks the buses (UART bytes, lines and baud; SPI transactions; I2C addresses; WS2812 frames and pixels), so most lessons need nothing.

Lessons 13-16 (OLED dashboard, motion light, plant monitor, remote control) are worked examples: the sketches carry their own SSD1306, PCF8574 LCD and NEC drivers on top of `Wire` only, and the goals read the OLED frame buffer, the relay contact, the LCD text and the 7-segment glyph.

## Parallel-safe workflow

Many agents can add parts and lessons at the same time without ever editing the same file, if each one follows these rules:

* **Own only new files.** A part owns `sim/devices/<kind>.ts`, `scene/parts/<kind>.ts`, `tests/lab-part-<kind>.test.ts`, `docs/lab-parts/<kind>.md`. A lesson owns `lessons/<id>.ts`, `firmware/sketches/<id>-*/`, `firmware/generated/<id>-*.ts`, its tests. Pick the kind or lesson id first: ids are the only shared namespace.
* **Never edit core:** `contract.ts`, `boards.ts`, `lessons/index.ts`, `lessons/kit.ts`, `sim/*.ts`, `scene/*.ts`, `parts/index.ts`, `parts/kit.ts`, `sim/devices/core/*`, `circuit-spec.ts`, `layout.ts`, `parts-copy.ts`, `ui/*`. Missing helper or wrong API: stop and report; do not patch it in your branch.
* **Lesson `order`:** choose a value nobody else uses (the registry throws on a duplicate). Agree on a block per agent (for example agent 3 takes 300-399) or take `max(order)+10` at the time you start; a clash is a loud error at load, never a silent overwrite.
* **Firmware:** `npm run lab:firmware -- <your-sketch>` only writes your own generated file. Never run the full build in a parallel branch (it rewrites every lesson).
* **`docs/lab-parts/README.md`** is regenerated by the scaffolder; if two agents scaffold at once, re-run the scaffolder's index step (any `lab:new-part` run) or merge by sorting the list.
* **Counts in tests** (`LESSONS.length`, card counts) are derived from the files, so adding a lesson never needs a test edit. A test that hard-codes a total will break: fix the test to derive it.
* **Run before reporting:** `npx tsx --test tests/lab-parts-contract.test.ts tests/lab-part-<kind>.test.ts tests/lab-lesson-modules.test.ts && npm run typecheck && npm run lint`. The orchestrator runs `npm run check` and the full `npx playwright test` after merging.

## Testing

```
npx tsx --test tests/lab-parts-contract.test.ts          # every kind: build, pins, anchors, apply, copy en+id, inputs
npx tsx --test tests/lab-*.test.ts                        # all lab unit and integration tests
npx tsx --test tests/lab-bus.test.ts tests/lab-nets.test.ts   # SPI / two-wire / WS2812 on real firmware, linked parts, power
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
Task: add the lab component "<kind>" (<what it is, e.g. DS18B20 temperature sensor, one-wire>)
      [and, if asked, the lesson "<lesson-id>" that uses it].
Read first: docs/lab-extending.md (all of it: protocols, part-to-part nets, power, boards, parallel-safe workflow),
apps/web/src/lab/sim/devices/types.ts, and the closest example
(<dht22.ts one-wire | hcsr04.ts pulse | potentiometer.ts adc | led.ts pwm | bme280.ts i2c | l298n.ts + motor.ts linked parts | lm7805.ts power
 | the test devices in tests/lab-bus.test.ts for spi, two-wire and ws2812>).

Do:
1. npm run lab:new-part -- <kind> --protocol <gpio|adc|pwm|pulse|i2c|onewire|uart|switch|spi|twowire|ws2812> [--desk] [--power <min>-<max>]
2. Implement the real behaviour in apps/web/src/lab/sim/devices/<kind>.ts from the datasheet (<link or key timings>), at SIGNAL level (real timings, bit order,
   addresses, registers). Typed state, typed inputs, copy in English and Indonesian in our own words. Declare `power` (supply rating); a source adds
   `supplies`, a regulator `regulators`, a driver `output()`, a contact `switches()`. Terminals that are not breadboard legs are pins without a hole.
3. Model the 3D body in apps/web/src/lab/scene/parts/<kind>.ts with real proportions in mm from the datasheet (<describe the look>), the lab palette helpers
   (scene/palette.ts, a new hex needs a `// ds-allow-hex` reason), no logos, no downloaded images. Every pin needs an anchor.
4. Fill tests/lab-part-<kind>.test.ts with exact-timing assertions; add a real-firmware test when a sketch is involved
   (compile fixtures with `npm run lab:firmware -- --raw x.ino out.json`, see tests/lab-bus.test.ts).
5. [Lesson] write apps/web/src/lab/lessons/<lesson-id>.ts (own `order` value), the sketch folder, then `npm run lab:firmware -- <lesson-id>-default`.
6. Run: npx tsx --test tests/lab-parts-contract.test.ts tests/lab-part-<kind>.test.ts tests/lab-lesson-modules.test.ts && npm run typecheck && npm run lint

Own only these files: the four created by the scaffolder (device, part, test, docs page, plus docs/lab-parts/README.md via the scaffolder) and, if asked, one lesson
(lessons/<id>.ts, its sketch folders, firmware/generated/<id>-*.ts, its tests).
Do not edit (report instead): any core file: contract.ts, boards.ts, sim/*.ts, sim/devices/core/*, scene/*.ts, scene/parts/index.ts, scene/parts/kit.ts, lessons/index.ts,
lessons/kit.ts, circuit-spec.ts, layout.ts, parts-copy.ts, ui/*, scripts/*, any other kind or lesson, deploy/*.
Rules: write everything yourself, no vendor models, no GPL/LGPL code or libraries in sketches (minimal drivers of your own; only permissive licences);
you may look at product photos and datasheets on the web but never download images into the repo; keep the simulation honest (no faked values);
scratch files go outside the repo (the session scratchpad); never use ports 5173 or 8787; do not commit; do not delete files you did not create.
Report: STATUS, files changed, test output, one screenshot path.
```
