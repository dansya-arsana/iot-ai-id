/**
 * TILT-SWITCH (SW-520D, protocol gpio): a rolling-ball switch on a 3-pin module. Upright the ball bridges the
 * contacts and SIG reads LOW; tilted past ~45 degrees the ball rolls away, the contact opens and the module pull-up
 * makes SIG read HIGH. Pure contact switch: no timing, no output other than the level. Written from public behaviour.
 * Pair: scene/parts/tilt-switch.ts (3D). Guide: docs/lab-extending.md
 */
import {defineDevice} from './types';
import {uno} from './core/util';

export type TiltSwitchState={tilted:boolean;high:boolean};

export const device=defineDevice<TiltSwitchState>({
 kind:'tilt-switch',protocol:'switch',
 pins:['VCC','SIG','GND'],holes:[0,1,2],
 copy:{
  name:{en:'Tilt switch (SW-520D)',id:'Saklar miring (SW-520D)'},
  desc:{en:'A ball inside bridges two contacts while upright. Tilt it and the ball rolls away, so the signal pin goes HIGH.',id:'Bola di dalamnya menghubungkan dua kontak saat tegak. Miringkan, bola menggelinding dan pin sinyal menjadi HIGH.'},
  note:{en:'Click it to tilt it.',id:'Klik untuk memiringkannya.'},
 },
 inputs:[{type:'toggle',key:'tilted',label:{en:'Tilted',id:'Miring'},default:false}],
 defaults:{tilted:false},
 create(ctx){
  // popover edits mutate ctx.props with no callback, so read lazily and drive only on change
  const sig=uno(ctx.net('SIG'));
  let last:boolean|null=null;
  const sync=():boolean=>{
   const t=ctx.props.tilted===true;
   if(sig&&t!==last)ctx.env.setPin(sig,t);
   last=t;return t;
  };
  sync();
  return {
   state:()=>{const t=sync();return {tilted:t,high:t};},
   tick(){sync();},
  };
 },
});
