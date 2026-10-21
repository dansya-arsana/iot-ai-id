/**
 * Device plugin API (lab platform). A device is the SIMULATION half of a part kind: it is wired to board pins and reacts to them.
 * The VISUAL half is a PartModule (scene/parts/<kind>.ts); both are linked by the same `kind` id and found by auto-discovery.
 * Pure: no DOM, no three.js, so Node tests, the server validator and the browser all load it.
 * Time is CPU cycles (SIM_CLOCK_HZ = 16 MHz, 16 cycles per microsecond); use us()/ms() instead of magic numbers.
 */
import type {BoardPin,PartInput,PartProps,PartSpec,PartState,PinMode,PinSample,UnoPin} from '../../contract';
import {SIM_CLOCK_HZ} from '../../contract';

export interface Copy{en:string;id:string}
export type Level=0|1;
export type Scalar=number|boolean|string|null;
/** Typed device state is a flat record of scalars so it can travel inside PartState {kind:'ext'}. */
export type DeviceState=Record<string,Scalar>;
/** Which hooks a device uses; picks the scaffolder template and documents the module. */
export type Protocol='gpio'|'adc'|'pwm'|'pulse'|'i2c'|'onewire'|'uart';

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
 tapUart?(cb:(byte:number,cycle:number)=>void):void;
 /** Send a byte to the MCU's UART RX. */
 uartSend?(byte:number):void;
}

export interface Pulse{level:Level;/** how long to hold it, in CPU cycles */holdCycles:number}
export interface PulsePlan{cancel():void;readonly active:boolean}

/** A neighbour part of the same circuit (for links such as lamp to LDR). Read props, never mutate them. */
export interface Sibling{spec:PartSpec;props:PartProps}

export interface DeviceCtx{
 id:string;kind:string;spec:PartSpec;
 /** Live props object; popover edits arrive here (Object.assign), read them when you need them. */
 props:PartProps;
 env:Env;
 /** Board pin a part pin is wired to (null for rails or unwired pins). */
 pin(name:string):UnoPin|null;
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
 adc?():{pin:UnoPin;volts:number}|null;
 i2c?:I2cSlave;
 uart?:UartTap;
}

/** A control the popover shows for this device; `key` is a PartProps key. Same shape family as ControlSpec in scene/parts/types. */
export type InputSpec=
 |{type:'range';key:string;label:Copy;min:number;max:number;step:number;unit?:string;default:number}
 |{type:'toggle';key:string;label:Copy;default:boolean}
 |{type:'choice';key:string;label:Copy;options:readonly {value:string;label:Copy}[];default:string};

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
