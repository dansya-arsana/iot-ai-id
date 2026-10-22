/**
 * Device plugin API (lab platform). A device is the SIMULATION half of a part kind: it is wired to board pins and reacts to them.
 * The VISUAL half is a PartModule (scene/parts/<kind>.ts); both are linked by the same `kind` id and found by auto-discovery.
 * Pure: no DOM, no three.js, so Node tests, the server validator and the browser all load it.
 * Time is CPU cycles (SIM_CLOCK_HZ = 16 MHz, 16 cycles per microsecond); use us()/ms() instead of magic numbers.
 */
import type {AnalogOnlyPin,BoardPin,PartInput,PartProps,PartSpec,PartState,PinMode,PinSample,UnoPin} from '../../contract';
import {SIM_CLOCK_HZ} from '../../contract';

export interface Copy{en:string;id:string}
export type Level=0|1;
export type Scalar=number|boolean|string|null;
/** Typed device state is a flat record of scalars so it can travel inside PartState {kind:'ext'}. */
export type DeviceState=Record<string,Scalar>;
/** Which hooks a device uses; picks the scaffolder template and documents the module. */
export type Protocol='gpio'|'adc'|'pwm'|'pulse'|'i2c'|'onewire'|'uart'|'switch'|'spi'|'twowire'|'ws2812';

export const CYCLES_PER_US=SIM_CLOCK_HZ/1e6;
/** Microseconds to CPU cycles. */
export const us=(n:number):number=>Math.round(n*CYCLES_PER_US);
/** Milliseconds to CPU cycles. */
export const ms=(n:number):number=>Math.round(n*CYCLES_PER_US*1000);

/** Pin samples of one slice (duty, frequency, last high pulse) for devices that read outputs of the MCU. */
export interface Frame{samples:Record<UnoPin,PinSample>;dtSec:number;cycles:number}

/** I2C slave on the TWI bus (avr8js AVRTWI). Addresses are 7-bit. */
export interface I2cSlave{
 address:number;
 /** START or repeated START addressed to this slave (after the address matched). */
 onStart?(repeated:boolean,write:boolean):void;
 /** Master wrote a byte. Return true to ACK. */
 onWrite(byte:number):boolean;
 /** Master wants a byte. `ack` says whether the master acknowledged the previous byte. */
 onRead(ack:boolean):number;
 onStop?():void;
}
/** What a device learns about one SPI byte: the master's mode and clock (SPCR/SPSR), when it happened, and its index since CS was asserted. */
export interface SpiInfo{mode:0|1|2|3;lsbFirst:boolean;clockHz:number;cycle:number;/** 0 for the first byte after CS went active (always counts up when the device has no CS) */index:number}
/**
 * SPI slave on the avr8js AVRSPI master (SPI.transfer / SPDR). Wire CS to any pin; `cs` names the part pin that carries it.
 * Bytes are delivered whole at the start of the transfer and the reply byte (MISO) is returned to the sketch when the transfer time
 * (clock divider x 8 cycles) has elapsed, exactly like the real shift register.
 */
export interface SpiSlave{
 /** Part pin name that carries chip select. Omit for a device that is always selected. */
 cs?:string;
 /** CS is active low (default true). */
 activeLow?:boolean;
 /** CS changed: `selected` is true while the device is addressed. Use it to reset a command state machine. */
 onSelect?(selected:boolean,cycle:number):void;
 /** One byte clocked by the master while this device is selected. Return the byte it shifts out on MISO. */
 onTransfer(mosi:number,info:SpiInfo):number;
}
/** Board-side form of an SpiSlave (pins resolved), what Env.attachSpi takes. */
export interface SpiBinding{csPin:UnoPin|null;activeLow:boolean;transfer(mosi:number,info:Omit<SpiInfo,'index'>):number}
/** Observes the bytes the sketch sends on the UART (Serial). */
export interface UartTap{onTx(byte:number,cycle:number):void}

/** What a device may ask of the board. Optional members are absent in minimal test environments. */
export interface Env{
 /** Drive an external level onto a pin (input pull-up / device output). */
 setPin(pin:UnoPin,level:boolean):void;
 setAdc(channel:number,volts:number):void;
 /** Run cb after `cycles` CPU cycles. */
 schedule(cycles:number,cb:()=>void):void;
 now():number;
 /** Effective level of a pin: the MCU's output when it drives, else the external level. */
 pinLevel?(pin:UnoPin):Level;
 pinMode?(pin:UnoPin):PinMode;
 /** Track a pin as a shared line (open drain): the monitor then reports the effective level, including the MCU releasing it. */
 watchLine?(pin:UnoPin):void;
 attachI2c?(slave:I2cSlave):void;
 /** Register an SPI slave on the AVRSPI master (created lazily, so sketches without SPI are untouched). */
 attachSpi?(slave:SpiBinding):void;
 tapUart?(cb:(byte:number,cycle:number)=>void):void;
 /** Send a byte to the MCU's UART RX. */
 uartSend?(byte:number):void;
}

export interface Pulse{level:Level;/** how long to hold it, in CPU cycles */holdCycles:number}
export interface PulsePlan{cancel():void;readonly active:boolean}

// ---------- part-to-part nets and power ----------
/** A voltage a device puts on one of its own pins (a bridge output, a battery terminal). `ohms` is its source impedance: the lowest wins on a shared net (default 0 = ideal). */
export interface PinDrive{volts:number;ohms?:number}
/** A source between two pins of a part (battery, power module). `maxMa` is what it can deliver (omit for a stiff source). */
export interface SupplyDecl{pos:string;neg:string;volts:number;maxMa?:number}
/** A linear regulator: out = min(volts, in - dropout), relative to gnd (LM7805: 5 V, 2 V dropout; AMS1117-3.3: 3.3 V, 1.1 V dropout). */
export interface RegulatorDecl{in:string;out:string;gnd:string;volts:number;dropout:number;maxMa?:number}
/** A contact that joins two pins of a part while closed (relay COM-NO, a switch). */
export interface SwitchDecl{a:string;b:string;closed:boolean}
/**
 * What a part needs from its supply. `rail` is [positive pin, negative pin]; the voltage across it must stay in min..max volts.
 * `external`: the part draws more than a board pin may give (a motor), so feeding it straight from a 5V/3V3/IO pin is a mistake.
 * `ma` is the typical current in milliamps.
 */
export interface PowerSpec{rail:readonly [string,string];min:number;max:number;ma?:number;external?:boolean}
/** Another part pin on the same net (wired part to part or through a shared board pin). */
export interface PeerRef{part:string;kind:string;pin:string}

/** A neighbour part of the same circuit (for links such as lamp to LDR). Read props, never mutate them. */
export interface Sibling{spec:PartSpec;props:PartProps}

export interface DeviceCtx{
 id:string;kind:string;spec:PartSpec;
 /** Live props object; popover edits arrive here (Object.assign), read them when you need them. */
 props:PartProps;
 env:Env;
 /** Board pin a part pin is wired to (null for rails or unwired pins). */
 pin(name:string):UnoPin|null;
 /** Like pin(), but also resolves A6/A7 of the Nano (analog input only: use it for adc() pins, never for digital reads). */
 analogPin(name:string):UnoPin|AnalogOnlyPin|null;
 /** The raw net entry of a part pin (can be '5V' or 'GND'). */
 net(name:string):BoardPin|undefined;
 siblings():readonly Sibling[];
 pinLevel(pin:UnoPin):Level;
 /** true while the MCU drives the pin as an output. */
 hostDrives(pin:UnoPin):boolean;
 /** Make `pin` a shared open-drain line (one-wire, I2C-like bit banging). Call once at create. */
 line(pin:UnoPin,idleHigh?:boolean):void;
 /** Scheduled pin drive in cycle time: sets pulses[0].level now+delay, then each next level after the previous hold. onDone fires after the last hold. */
 drive(pin:UnoPin,pulses:readonly Pulse[],o?:{delayCycles?:number;onDone?:()=>void}):PulsePlan;
 schedule(cycles:number,cb:()=>void):void;
 uartSend(byte:number):void;
 /** Part pins electrically tied to this part's pin by a part-to-part wire (Circuit.links) or a shared board pin. Never includes the pin itself. */
 peers(pin:string):readonly PeerRef[];
 /** Voltage of the net a pin sits on, in volts: board rails, supplies, regulators and the output() of linked parts. null = floating (nothing drives it). */
 volts(pin:string):number|null;
 /** Voltage across this part's declared power rail (def.power.rail), or null when it is not wired to a supply. */
 supply():number|null;
}

export interface DeviceModel<S=DeviceState|PartState>{
 /** Typed state shown by the scene (PartModule.apply) and the HUD. */
 state():S;
 /** A typed input event from the UI (PartInput). Props edits do not come here, they mutate ctx.props. */
 setInput?(i:PartInput):void;
 /** Once per simulated slice with the pin samples (duty/frequency readers: LED, servo, motor, buzzer). */
 update?(f:Frame):void;
 /** Once per slice with the cycles that elapsed; for time-driven devices. */
 tick?(cycles:number,now:number):void;
 /** Edge on a pin this device is wired to. Cycle is the CPU cycle of the edge. */
 onPinChange?(pin:UnoPin,level:Level,cycle:number):void;
 /** Voltage this device puts on an analog pin (null: none). */
 adc?():{pin:UnoPin|AnalogOnlyPin;volts:number}|null;
 i2c?:I2cSlave;
 spi?:SpiSlave;
 /** The voltage this part drives on one of its pins right now (null: high impedance). Linked parts read it with ctx.volts(). */
 output?(pin:string):PinDrive|null;
 /** Contacts that join two of its pins right now (relay COM-NO). The net solver merges the nets of a closed contact. */
 switches?():readonly SwitchDecl[];
 uart?:UartTap;
}

/** A control the popover shows for this device; `key` is a PartProps key. Same shape family as ControlSpec in scene/parts/types. */
export type InputSpec=
 |{type:'range';key:string;label:Copy;min:number;max:number;step:number;unit?:string;default:number;advanced?:boolean}
 |{type:'toggle';key:string;label:Copy;default:boolean;advanced?:boolean}
 |{type:'choice';key:string;label:Copy;options:readonly {value:string;label:Copy}[];default:string;/** lay the chips out in this many columns (keypad grid) */grid?:number;/** momentary tap: set the value, then back to `default` after this many ms */momentaryMs?:number;/** same fold title = one collapsed disclosure in the popover */fold?:Copy;advanced?:boolean}
 |{type:'terminal';key:string;label:Copy;placeholder:Copy;/** ext input type that receives the typed line (`{line,ending}`) */input:string;/** state field with the transcript, one row per line: "< " from the sketch, "> " from the user */log:string;/** key of the choice input that holds the line ending */ending?:string;advanced?:boolean};
/** Inputs flagged `advanced` stay in the schema (tests, experiments) but get no popover control. */
export type InputFlags={advanced?:boolean};

export interface DeviceCopy{name:Copy;desc:Copy;note?:Copy}

export interface DeviceDef<S=DeviceState|PartState>{
 /** Kind id; must equal the PartModule's kind. */
 kind:string;
 protocol:Protocol;
 /** Pins in physical order (becomes PART_PINS[kind]). Off-board props use []. */
 pins:readonly string[];
 /** Breadboard hole-column offsets per pin for on-board parts (becomes PIN_COLS[kind]); omit for desk props. */
 holes?:readonly number[];
 /** Body x extent (mm, relative to the first pin) when wider than the legs (Uno clearance check). */
 bodyX?:readonly [number,number];
 /** Name/description; builtin kinds keep theirs in parts-copy.ts. */
 copy?:DeviceCopy;
 /** Typed schema of what the user may set; the part's popover is generated from it. */
 inputs:readonly InputSpec[];
 /** Props a fresh part starts with; missing props are filled from here. */
 defaults?:PartProps;
 /** true for the original builtin kinds whose state() already is a PartState; plugin devices return a flat DeviceState. */
 legacyState?:boolean;
 /** Supply requirements: the lab warns when the rail is outside min..max volts or an `external` part hangs on a board pin. */
 power?:PowerSpec;
 /** Sources this part provides (battery, breadboard power module); evaluated from the live props. */
 supplies?:(props:PartProps)=>readonly SupplyDecl[];
 /** Linear regulators this part contains (LM7805, AMS1117). */
 regulators?:(props:PartProps)=>readonly RegulatorDecl[];
 /** 'not-emulated': the part is a visual and reference model only (no signal behaviour). The UI shows an honest badge. Default 'emulated'. */
 runtime?:'emulated'|'not-emulated';
 create(ctx:DeviceCtx):DeviceModel<S>;
}
export const defineDevice=<S>(d:DeviceDef<S>):DeviceDef<S>=>d;

/** Narrow a PartState to the typed state of a plugin device (undefined when it is another kind). */
export function extState<S extends DeviceState>(s:PartState,type:string):S|undefined{
 return s.kind==='ext'&&s.type===type?s.v as S:undefined;
}
/** Wrap typed values into the PartInput the runner understands. */
export const extInput=(type:string,v:Record<string,number|boolean|string>):PartInput=>({kind:'ext',type,v});

export const num=(v:unknown,d:number):number=>typeof v==='number'&&Number.isFinite(v)?v:d;
export const clamp=(v:number,lo:number,hi:number):number=>Math.min(hi,Math.max(lo,v));
export const round1=(v:number):number=>Math.round(v*10)/10;
