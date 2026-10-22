/**
 * Arduino lab (/lab) shared contract. Owned by the sim-core module: other modules import it and never edit it.
 * Plain types and constant data only. No imports, no DOM, no side effects: safe in Node tests and build scripts.
 */

// ---------- lessons ----------
// Lessons are modules (lessons/<id>.ts, auto-discovered). The registry fills these tables; they are re-exported here so every import keeps working.
// Exception to "no imports": lessons/index loads no runtime code from this file, so there is no cycle.
import {LESSON_IDS} from './lessons/index';
import type {PowerNote} from './sim/power';
export {LESSON_IDS,CIRCUITS,FIRMWARE_SPEC} from './lessons/index';
/** Any registered lesson id (a kebab-case string). */
export type LessonId=string;
export function isLessonId(s:string|null|undefined):s is LessonId{return !!s&&LESSON_IDS.includes(s);}

// ---------- board ----------
export const SIM_CLOCK_HZ=16_000_000;
export const FLASH_WORDS=16384; // ATmega328P: 32 KiB program memory
export {MOTOR_MAX_RPM} from './constants';
export const UNO_PINS=['D0','D1','D2','D3','D4','D5','D6','D7','D8','D9','D10','D11','D12','D13','A0','A1','A2','A3','A4','A5'] as const;
export type UnoPin=typeof UNO_PINS[number];
export type PowerPin='5V'|'3V3'|'GND'|'VIN';
/** A6 and A7 exist on the Nano family only (ADC6/ADC7 of the ATmega328P in TQFP): they read analog voltages and have no digital function, no port bit, no pull-up. */
export type AnalogOnlyPin='A6'|'A7';
export const ANALOG_ONLY_PINS:readonly AnalogOnlyPin[]=['A6','A7'];
export type BoardPin=UnoPin|PowerPin|AnalogOnlyPin;
/** The boards a circuit can sit on. 'uno' and 'nano' run (same ATmega328P in avr8js); 'esp32' is a model only (see sim/boards.ts). */
export type BoardId='uno'|'nano'|'esp32';
export type AvrPort='B'|'C'|'D';
/** ATmega328P port and bit behind each UNO pin. */
export const PIN_PORT:Record<UnoPin,{port:AvrPort;bit:number}>={
 D0:{port:'D',bit:0},D1:{port:'D',bit:1},D2:{port:'D',bit:2},D3:{port:'D',bit:3},D4:{port:'D',bit:4},D5:{port:'D',bit:5},D6:{port:'D',bit:6},D7:{port:'D',bit:7},
 D8:{port:'B',bit:0},D9:{port:'B',bit:1},D10:{port:'B',bit:2},D11:{port:'B',bit:3},D12:{port:'B',bit:4},D13:{port:'B',bit:5},
 A0:{port:'C',bit:0},A1:{port:'C',bit:1},A2:{port:'C',bit:2},A3:{port:'C',bit:3},A4:{port:'C',bit:4},A5:{port:'C',bit:5},
};
export const PWM_PINS:readonly UnoPin[]=['D3','D5','D6','D9','D10','D11'];
export const ADC_CHANNEL:Partial<Record<UnoPin|AnalogOnlyPin,number>>={A0:0,A1:1,A2:2,A3:3,A4:4,A5:5,A6:6,A7:7};
/** Clickable features of the UNO board itself. The scene treats them like part ids. */
export const BOARD_FEATURES=['uno.usb','uno.power-jack','uno.mcu','uno.usb-chip','uno.crystal','uno.reset','uno.led-on','uno.led-l','uno.led-txrx','uno.digital-header','uno.analog-header','uno.power-header','uno.icsp'] as const;
export type BoardFeatureId=typeof BOARD_FEATURES[number];
/** A PartSpec.id or a BoardFeatureId. */
export type TargetId=string;

// ---------- circuit ----------
export type BuiltinPartKind='led'|'resistor'|'button'|'potentiometer'|'rgb-led'|'ldr'|'lamp'|'hcsr04'|'obstacle'|'buzzer'|'transistor'|'diode'|'motor'|'servo';
/** Any registered kind id. New kinds are added by dropping files into scene/parts and sim/devices (docs/lab-extending.md); they never edit this union. */
export type PartKind=string;
/** Physical pins per kind (lamp and obstacle are off-board props). motor.net.DRIVE is logical: the PWM pin behind its driver transistor. */
export const PART_PINS:Record<string,readonly string[]>={led:['A','C'],resistor:['1','2'],button:['1','2'],potentiometer:['VCC','SIG','GND'],'rgb-led':['R','G','B','K'],ldr:['A','B'],lamp:[],hcsr04:['VCC','TRIG','ECHO','GND'],obstacle:[],buzzer:['+','-'],transistor:['B','C','E'],diode:['A','K'],motor:['+','-'],servo:['SIG','V','GND']};
export type LedColor='red'|'yellow'|'green'|'blue'|'white';
/**
 * Props by kind: led {color:LedColor}; resistor {ohms, seriesWith?:partId, role:'series'|'pull-down'|'divider'|'base'};
 * button {pull:'down'} (pressed=HIGH); potentiometer {value 0..1023}; ldr {fixedOhms}; lamp {target:ldrId, distanceCm 5..150, on};
 * obstacle {target:hcsr04Id, distanceCm 3..250, shape:'box'|'car'|'ball'|'wall'}; transistor {model:'NPN'}; others {}.
 */
export type PartProps=Record<string,string|number|boolean>;
/** net: part pin -> board pin it is electrically tied to (through series resistors / driver). The simulator reads only this. */
export interface PartSpec{id:string;kind:PartKind;net:Partial<Record<string,BoardPin>>;props:PartProps;}
export type WireColor='red'|'black'|'orange'|'yellow'|'green'|'blue'|'purple'|'white';
/** Jumper from a board header pin to a part pin, or to a breadboard rail (componentId 'bb', pin '5v-rail'|'gnd-rail'). Same shape as our canvas Wiring. Visual/export only. */
export interface Wire{componentId:string;pin:string;boardPin:BoardPin;color:WireColor;}
/** One end of a part-to-part wire. */
export interface PartPinRef{part:string;pin:string;}
/**
 * A jumper between two part pins (L298N OUT1 to a motor, a relay COM to a lamp). It carries no board pin, so the pins it joins have no
 * entry in PartSpec.net unless they also reach a board pin some other way. Devices see the other end through DeviceCtx.peers()/volts().
 */
/** `seated`: the two pins plug straight into each other (a motor plug in its socket), so the net exists but no jumper is drawn. */
export interface PartLink{a:PartPinRef;b:PartPinRef;color:WireColor;seated?:boolean;}
export interface Circuit{parts:PartSpec[];wires:Wire[];/** part-to-part wires (optional: absent means none) */links?:PartLink[];/** the board the circuit sits on (absent: 'uno') */board?:BoardId;}
export const INPUT_RANGES={potentiometer:{min:0,max:1023},lamp:{min:5,max:150},obstacle:{min:3,max:250}} as const;


// ---------- firmware (generated by scripts/build-lab-firmware.ts) ----------
/** C declaration per ctype: uint8 'byte', uint16 'unsigned int', int16 'int', uint32 'unsigned long', int32 'long'. */
export type ParamCType='uint8'|'int16'|'uint16'|'int32'|'uint32';
export interface ParamSpec{name:string;ctype:ParamCType;defaultValue:number;min:number;max:number;step:number;}
/** Sketch folder = `${lessonId}-${variant.id}`. The first variant is the default. */
export interface VariantSpec{id:string;params:ParamSpec[];/** board the sketch is compiled for (default 'uno'); 'nano' uses the Nano core, which defines A6 and A7 */board?:BoardId;}
export interface FirmwareParam extends ParamSpec{offset:number;} // byte offset of the little-endian initial value in the flash image
export interface FirmwareVariant{
 id:string; sketch:string;      // e.g. 'blink-default'
 source:string;                 // exact .ino text (default values)
 template:string;               // source with each param initialiser replaced by {{name}}
 flashBase64:string; bytes:number; sha256:string; // sha256 of source
 lines:[number,number,number][]; // [firstWord,lastWord,inoLine1Based], sorted, word = byte address / 2
 params:FirmwareParam[];
}
export interface FirmwareBundle{lessonId:LessonId;variants:FirmwareVariant[];}
/** One generated file `firmware/generated/<sketch>.ts` exports `sketch`: the compiled variant plus the toolchain string that built it. */
export interface FirmwareSketch{toolchain:string;lessonId:LessonId;variant:FirmwareVariant;}
export interface FirmwareRegistry{toolchain:string;lessons:Record<LessonId,FirmwareBundle>;}
export type ParamValues=Record<string,number>;

// ---------- simulator (apps/web/src/lab/sim exports createLabRunner) ----------
export type SimStatus='idle'|'stopped'|'running'|'error';
export type PinMode='input'|'input-pullup'|'output';
export interface PinSample{mode:PinMode;level:0|1;duty:number;freqHz:number;highUs:number;analog:number|null;}
export type PartInput=
 |{kind:'button';pressed:boolean}
 |{kind:'potentiometer';value:number}
 |{kind:'lamp';distanceCm?:number;on?:boolean}
 |{kind:'obstacle';distanceCm:number}
 /** Input of a plugin device (sim/devices): `v` holds the keys of the device's `inputs` schema. */
 |{kind:'ext';type:string;v:Record<string,number|boolean|string>};
export type PartState=
 |{kind:'led';brightness:number;on:boolean;currentMa:number;overCurrent:boolean}
 |{kind:'rgb-led';r:number;g:number;b:number}
 |{kind:'button';pressed:boolean}
 |{kind:'potentiometer';value:number}
 |{kind:'ldr';lux:number;adc:number}
 |{kind:'lamp';distanceCm:number;on:boolean}
 |{kind:'hcsr04';pinging:boolean;echoCm:number|null}
 |{kind:'obstacle';distanceCm:number}
 |{kind:'buzzer';on:boolean;freqHz:number}
 |{kind:'motor';duty:number;rpm:number}
 |{kind:'servo';pulseUs:number;angleDeg:number}
 |{kind:'passive'}
 /** State of a plugin device: `type` is the kind id, `v` the device's typed state (read it with extState() from scene/parts/kit). */
 |{kind:'ext';type:string;v:Record<string,number|boolean|string|null>};
export interface SimSnapshot{
 status:SimStatus; error:string|null;
 simTimeMs:number;      // emulated time since load
 speed:number;          // emulated/real time ratio (1 = real time)
 pins:Record<UnoPin,PinSample>;
 parts:Record<string,PartState>; // every PartSpec id of the loaded circuit
 currentLine:number|null;        // 1-based .ino line of the last executed sketch instruction
 txActive:boolean;               // UART sent a byte in the last 30 ms (TX LED)
 /** Friendly supply warnings (a 3.3 V part on 5 V, a motor on a board pin...), refreshed about every 100 ms of simulated time. Absent in old snapshots. */
 power?:PowerNote[];
}
export interface LoadReport{sketch:string;bytes:number;toolchain:string;patched:{name:string;value:number;offset:number}[];}
export interface LabRunner{
 /** Reset the emulated ATmega328P and load the variant with params written into flash. Throws RangeError on bad params. Status -> 'stopped'. */
 load(variant:FirmwareVariant,params:ParamValues,circuit:Circuit,toolchain:string):LoadReport;
 start():void;
 stop():void;
 /** Advance by real elapsed ms (rAF); caps at 50 ms and ~12 ms CPU; no-op unless running. */
 tick(wallMs:number):SimSnapshot;
 /** Advance exactly simMs of emulated time (tests); no-op unless running. */
 advance(simMs:number):SimSnapshot;
 snapshot():SimSnapshot;
 setInput(partId:string,input:PartInput):void;
 setPartProps(partId:string,props:PartProps):void;
 onSerial(cb:(chunk:string)=>void):()=>void;
 serialText():string;
 dispose():void;
}
export type CreateLabRunner=()=>LabRunner;

// ---------- 3D scene (apps/web/src/lab/scene exports createLabScene) ----------
export type ViewCommand='rotate-left'|'rotate-right'|'zoom-in'|'zoom-out'|'reset';
export interface ScreenPoint{x:number;y:number;visible:boolean;} // CSS px relative to the canvas top-left
export interface SceneSettings{grid:boolean;autoRotate:boolean;reducedMotion:boolean;}
export interface LabSceneOptions{
 canvas:HTMLCanvasElement; settings:SceneSettings;
 onSelect(target:TargetId|null):void;
 onHover(target:TargetId|null,at:ScreenPoint|null):void;
 onInput(partId:string,input:PartInput):void;
}
export interface LabScene{
 readonly ready:Promise<void>;
 setLesson(lesson:LessonId,circuit:Circuit):void;
 setPartProps(partId:string,props:PartProps):void;
 update(snap:SimSnapshot,dtMs:number):void; // apply state + render one frame
 resize(cssWidth:number,cssHeight:number,dpr:number):void;
 project(target:TargetId):ScreenPoint|null;
 view(cmd:ViewCommand):void;
 focus(target:TargetId|null):void;
 highlight(target:TargetId|null):void;
 setSettings(s:Partial<SceneSettings>):void;
 zoomLevel():number; // 1 = lesson preset
 dispose():void;
}
/** Throws Error('webgl-unavailable') when no WebGL context can be created. */
export type CreateLabScene=(o:LabSceneOptions)=>LabScene;
