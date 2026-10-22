/**
 * HALL-A3144 device (protocol 'switch'): a unipolar Hall-effect switch on a 3-pin module with a pull-up on the output.
 * Written from the public behaviour of the A3144 family: the output is an open-collector NPN that turns ON (pulls SIG LOW) when a SOUTH
 * pole facing the marked face gives a flux density above the operate point BOP (typ 70 G, 35..160 G) and turns OFF again only when the
 * field falls below the release point BRP (typ 50 G), so the 20 G hysteresis gives a clean edge. A north pole never operates it.
 * Supply 4.5..24 V. The magnet is a small disc whose on-axis field falls with the cube of distance: B = 2500 G * (5 / (5 + d))^3
 * (d in mm from the magnet face to the sensor face), a rough but monotonic model of a 10 mm neodymium disc.
 * Pair: scene/parts/hall-a3144.ts (3D). Both are auto-discovered. Guide: docs/lab-extending.md
 */
import {defineDevice,clamp,num} from './types';
import {uno} from './core/util';

export type HallA3144State={distance:number;field:number;pole:string;active:boolean;high:boolean;bop:number;brp:number};

/** Datasheet-typical thresholds in gauss. */
export const BOP=70;
export const BRP=50;
/** Flux density at the sensor (gauss, positive = south pole on the marked face) for a magnet `mm` away. */
export function fieldAt(mm:number,pole:string):number{
 const b=2500*Math.pow(5/(5+Math.max(0,mm)),3);
 return pole==='south'?b:pole==='north'?-b:0;
}

export const device=defineDevice<HallA3144State>({
 kind:'hall-a3144',protocol:'switch',
 pins:['VCC','SIG','GND'],holes:[0,1,2],
 power:{rail:['VCC','GND'],min:4.5,max:24,ma:6},
 copy:{
  name:{en:'Hall effect sensor (A3144)',id:'Sensor efek Hall (A3144)'},
  desc:{en:'Senses a magnet without touching it. A south pole close enough pulls the signal pin LOW; moving it away releases it, with a little hysteresis.',id:'Merasakan magnet tanpa menyentuh. Kutub selatan yang cukup dekat menarik pin sinyal ke LOW; menjauhkannya melepas, dengan sedikit histeresis.'},
  note:{en:'Click it to move a magnet closer. Only a south pole on the marked face switches it. It needs 4.5 V or more.',id:'Klik untuk mendekatkan magnet. Hanya kutub selatan di sisi bertanda yang menyalakannya. Butuh 4,5 V atau lebih.'},
 },
 inputs:[
  {type:'range',key:'distance',label:{en:'Magnet distance',id:'Jarak magnet'},min:0,max:40,step:0.5,unit:'mm',default:40},
  {type:'choice',key:'pole',label:{en:'Pole facing the sensor',id:'Kutub menghadap sensor'},options:[{value:'south',label:{en:'South',id:'Selatan'}},{value:'north',label:{en:'North',id:'Utara'}}],default:'south'},
 ],
 defaults:{distance:40,pole:'south'},
 create(ctx){
  const sig=uno(ctx.net('SIG'));
  let on=false,last:boolean|null=null;
  const read=()=>{
   const d=clamp(num(ctx.props.distance,40),0,40);
   const pole=ctx.props.pole==='north'?'north':'south';
   const b=fieldAt(d,pole);
   // Schmitt behaviour: operate above BOP, release below BRP, hold in between
   if(!on&&b>=BOP)on=true;else if(on&&b<BRP)on=false;
   return {d,pole,b};
  };
  const sync=()=>{
   const r=read();
   // open collector: ON pulls the module line low, OFF lets the pull-up lift it
   if(sig&&on!==last)ctx.env.setPin(sig,!on);
   last=on;return r;
  };
  sync();
  return {
   state:()=>{const r=sync();return {distance:r.d,field:Math.round(r.b),pole:r.pole,active:on,high:!on,bop:BOP,brp:BRP};},
   tick(){sync();},
  };
 },
});
