/**
 * Board variants. Pure data: the lab runs ONE emulated chip (ATmega328P in avr8js), so the Uno and the Nano are two faces of the same
 * simulation: the same registers, the same pin numbers D0-D13 and A0-A5; the Nano adds A6 and A7 (analog input only) and is smaller.
 * The ESP32 is a model only: a different CPU that avr8js cannot run, so it stays `runtime:'not-emulated'` and the runner refuses to load it.
 */
import type {AnalogOnlyPin,BoardId,PowerPin,UnoPin} from './contract';
import {ANALOG_ONLY_PINS,UNO_PINS} from './contract';

export interface BoardDef{
 id:BoardId;
 name:{en:string;id:string};
 chip:string;
 /** 'emulated': a sketch compiled for it runs in the browser. 'not-emulated': visual model only, the UI says so. */
 runtime:'emulated'|'not-emulated';
 /** arduino-cli board id used to compile its sketches (emulated boards only) */
 fqbn?:string;
 usb:string;
 /** digital-capable pins */
 pins:readonly UnoPin[];
 /** analog input only pins (no digitalRead/Write, no pull-up) */
 analogOnly:readonly AnalogOnlyPin[];
 power:readonly PowerPin[];
 /** barrel jack (7-12 V) present */
 jack:boolean;
}
const POWER:readonly PowerPin[]=['5V','3V3','GND','VIN'];
export const BOARDS:Readonly<Record<BoardId,BoardDef>>={
 uno:{id:'uno',name:{en:'Arduino UNO R3',id:'Arduino UNO R3'},chip:'ATmega328P',runtime:'emulated',fqbn:'arduino:avr:uno',usb:'USB-B',pins:UNO_PINS,analogOnly:[],power:POWER,jack:true},
 nano:{id:'nano',name:{en:'Nano-style board (ATmega328P)',id:'Papan gaya Nano (ATmega328P)'},chip:'ATmega328P',runtime:'emulated',fqbn:'arduino:avr:nano:cpu=atmega328',usb:'mini-USB',pins:UNO_PINS,analogOnly:ANALOG_ONLY_PINS,power:POWER,jack:false},
 esp32:{id:'esp32',name:{en:'ESP32-DevKitC',id:'ESP32-DevKitC'},chip:'ESP32-WROOM-32',runtime:'not-emulated',usb:'micro-USB',pins:[],analogOnly:[],power:['3V3','GND','VIN'],jack:false},
};
export const boardOf=(c:{board?:BoardId}|undefined):BoardDef=>BOARDS[c?.board??'uno'];
/** Every pin name a circuit on this board may use as a wire endpoint. */
export const boardPinNames=(id:BoardId):readonly string[]=>{const b=BOARDS[id];return [...b.pins,...b.analogOnly,...b.power];};
export const isAnalogOnly=(p:string):p is AnalogOnlyPin=>(ANALOG_ONLY_PINS as readonly string[]).includes(p);
