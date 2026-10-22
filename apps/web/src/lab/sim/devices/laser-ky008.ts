/**
 * LASER-KY008 device (protocol 'gpio'): a 650 nm red laser diode on a 3 pin dongle (class IIIa, about 5 mW), with a series resistor
 * on the board. The diode sits between S and the minus pin, so the SIGNAL pin lights it: HIGH = on, LOW = off, PWM = dimmer (the
 * average current follows the duty). The middle pin is marked +5 V on the silkscreen but is not needed to switch the diode.
 * It draws about 30 mA, which an Arduino pin can source only for short tests: the datasheet limit is 40 mA per pin.
 * Written from public behaviour. Pair: scene/parts/laser-ky008.ts (3D). Guide: docs/lab-extending.md
 */
import {defineDevice} from './types';

export type LaserKy008State={
 /** the diode is lit (signal high or PWM above 2 percent, ground wired) */
 on:boolean;
 /** average duty of the signal pin, 0..1 (1 = steady HIGH) */
 duty:number;
 /** signal edges seen since load */
 edges:number;
 /** estimated diode current in mA (30 mA x duty) */
 ma:number;
};

export const LASER_MA=30;

export const device=defineDevice<LaserKy008State>({
 kind:'laser-ky008',protocol:'gpio',
 pins:['SIG','VCC','GND'],holes:[0,1,2],
 power:{rail:['VCC','GND'],min:4.5,max:5.5,ma:30},
 copy:{
  name:{en:'Laser diode dongle (KY-008)',id:'Dongle dioda laser (KY-008)'},
  desc:{en:'A small red laser on a 3 pin module. A HIGH on the signal pin lights it; PWM makes it dimmer. Never point a real laser at a face.',id:'Laser merah kecil pada modul 3 pin. HIGH di pin sinyal menyalakannya; PWM membuatnya lebih redup. Jangan pernah mengarahkan laser asli ke wajah.'},
  note:{en:'The beam is drawn along the board. A real one reaches across the room.',id:'Sinarnya digambar sepanjang papan. Yang asli bisa menembus seisi ruangan.'},
 },
 inputs:[],
 create(ctx){
  const sig=ctx.pin('SIG');
  let duty=0,edges=0;
  return {
   state:()=>{
    // the diode needs its return path: no ground wire, no light
    const grounded=ctx.net('GND')==='GND';
    const d=grounded?duty:0;
    return {on:d>0.02,duty:Math.round(d*100)/100,edges,ma:Math.round(d*LASER_MA)};
   },
   onPinChange(pin){if(pin===sig)edges++;},
   update(f){if(!sig)return;const s=f.samples[sig];duty=s.mode==='output'?s.duty:0;},
  };
 },
});
