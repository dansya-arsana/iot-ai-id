/**
 * ARDUINO-NANO (desk model of the board): a Nano V3 class module, same ATmega328P as the Uno.
 * The lab runs ONE emulated chip, so the Nano is a BOARD VARIANT, not a part: set `board:'nano'` on the circuit (CircuitSpec.board,
 * Circuit.board) and the scene swaps the Uno for the Nano model (scene/board-nano.ts), the runner runs the same flash on the same
 * avr8js machine and A6/A7 become analog-only inputs (sim/boards.ts). This kind remains as the model you can place on the desk
 * and in the parts gallery; it carries no pins of its own, so it is not model-only any more: it describes a board that runs.
 * Nano core sketches (fqbn arduino:avr:nano:cpu=atmega328) define A6 and A7; on the Uno core use analogRead(6).
 */
import {defineDevice} from './types';

export type ArduinoNanoState={usbPower:boolean;chip:string;/** the board id a circuit selects to run on it */board:string;/** extra analog-only inputs vs the Uno */analogOnly:string};

export const device=defineDevice<ArduinoNanoState>({
 kind:'arduino-nano',protocol:'gpio',
 pins:[],
 copy:{
  name:{en:'Nano-style board (ATmega328P)',id:'Papan gaya Nano (ATmega328P)'},
  desc:{en:'A small 30-pin board with the same ATmega328P as the Uno, made to sit on a breadboard. It runs your sketch: choose the Nano as the circuit board. It adds two analog-only pins, A6 and A7.',id:'Papan kecil 30 pin dengan ATmega328P yang sama seperti Uno, dibuat untuk dipasang di breadboard. Papan ini menjalankan sketsamu: pilih Nano sebagai papan rangkaian. Ada dua pin khusus analog tambahan, A6 dan A7.'},
  note:{en:'Pin numbers D0-D13 and A0-A5 match the Uno. A6 and A7 can only be read with analogRead.',id:'Nomor pin D0-D13 dan A0-A5 sama dengan Uno. A6 dan A7 hanya bisa dibaca dengan analogRead.'},
 },
 inputs:[{type:'toggle',key:'usbPower',label:{en:'USB power',id:'Daya USB'},default:true}],
 defaults:{usbPower:true},
 create(ctx){return {state:()=>({usbPower:ctx.props.usbPower!==false,chip:'ATmega328P',board:'nano',analogOnly:'A6,A7'})};},
});
