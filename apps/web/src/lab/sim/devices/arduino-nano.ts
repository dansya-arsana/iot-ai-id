/**
 * ARDUINO-NANO device (visual-only variant): a Nano V3 class board, same ATmega328P as the Uno on the bench.
 * The lab runner has exactly one MCU board, built in (machine.ts), and a part kind cannot replace it, so this
 * kind is a desk prop with no pins: it shows the form factor and the pin names, it does not run a sketch.
 * Sketches written for the Uno (same chip, same pin numbers D2..D13, A0..A5) behave identically on a real Nano.
 */
import {defineDevice} from './types';

export type ArduinoNanoState={usbPower:boolean;chip:string};

export const device=defineDevice<ArduinoNanoState>({
 kind:'arduino-nano',protocol:'gpio',runtime:'not-emulated',
 pins:[],
 copy:{
  name:{en:'Nano-style board (ATmega328P)',id:'Papan gaya Nano (ATmega328P)'},
  desc:{en:'A small 30-pin board with the same ATmega328P as the Uno, made to sit on a breadboard. Shown as a model only.',id:'Papan kecil 30 pin dengan ATmega328P yang sama seperti Uno, dibuat untuk dipasang di breadboard. Hanya model tampilan.'},
  note:{en:'Visual only: the lab simulates one built-in board, so run your sketch on the Uno. Pin numbers match.',id:'Hanya tampilan: lab mensimulasikan satu papan bawaan, jadi jalankan sketsa di Uno. Nomor pin sama.'},
 },
 inputs:[{type:'toggle',key:'usbPower',label:{en:'USB power',id:'Daya USB'},default:true}],
 defaults:{usbPower:true},
 create(ctx){return {state:()=>({usbPower:ctx.props.usbPower!==false,chip:'ATmega328P'})};},
});
