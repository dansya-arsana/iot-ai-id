/**
 * RGB-MODULE-KY016 device (protocol 'pwm'): a 5 mm common-cathode RGB LED with a 150 ohm resistor in each colour leg, on a 4 pin
 * header (R, G, B, minus). Each colour pin is its own input: HIGH = full, PWM = brightness (the eye averages the duty).
 * Current per colour = (5 V - Vf) / 150 ohm with Vf about 2.0 V red, 3.0 V green and blue, so about 20 mA red and 13 mA green
 * or blue at full: inside the 40 mA pin limit. Written from public behaviour. The header order on real boards varies by
 * maker; ours is R, G, B, minus. Pair: scene/parts/rgb-module-ky016.ts (3D). Guide: docs/lab-extending.md
 */
import {defineDevice} from './types';
const r2=(v:number):number=>Math.round(v*100)/100;
import {duty as dutyOf,freq} from './core/util';

export type RgbModuleKy016State={
 /** duty of each colour pin, 0..1 */
 r:number;g:number;b:number;
 /** PWM frequency seen on the red pin in Hz (0 = steady) */
 freqHz:number;
 /** total LED current in mA */
 ma:number;
};

export const RGB_RESISTOR=150;
const VF={r:2.0,g:3.0,b:3.0};

export const device=defineDevice<RgbModuleKy016State>({
 kind:'rgb-module-ky016',protocol:'pwm',
 pins:['R','G','B','GND'],holes:[0,1,2,3],
 copy:{
  name:{en:'RGB LED module (KY-016)',id:'Modul LED RGB (KY-016)'},
  desc:{en:'Three colours in one 5 mm LED with its own resistors. Give each colour pin a PWM level and the colours mix.',id:'Tiga warna dalam satu LED 5 mm dengan resistor sendiri. Beri tiap pin warna level PWM dan warnanya bercampur.'},
  note:{en:'No resistor needed: the module has one per colour.',id:'Tidak perlu resistor: modul sudah punya satu per warna.'},
 },
 inputs:[],
 create(ctx){
  let r=0,g=0,b=0,freqHz=0;
  return {
   state:()=>{
    const gnd=ctx.net('GND')==='GND';
    const rr=gnd?r:0,gg=gnd?g:0,bb=gnd?b:0;
    const mA=(d:number,vf:number)=>d*Math.max(0,5-vf)/RGB_RESISTOR*1000;
    return {r:r2(rr),g:r2(gg),b:r2(bb),freqHz:Math.round(freqHz),ma:Math.round(mA(rr,VF.r)+mA(gg,VF.g)+mA(bb,VF.b))};
   },
   update(f){r=dutyOf(ctx.net('R'),f);g=dutyOf(ctx.net('G'),f);b=dutyOf(ctx.net('B'),f);freqHz=freq(ctx.net('R'),f);},
  };
 },
});
