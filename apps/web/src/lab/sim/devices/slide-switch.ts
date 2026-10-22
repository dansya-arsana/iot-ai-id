/**
 * SLIDE-SWITCH (SPDT, protocol switch): a three-leg slide switch. The lever joins COM to throw A or to throw B (break-before-make,
 * never both, never neither); a toggle in the popover moves it. It is a plain mechanical contact: no timing, no power draw.
 * The contact is declared with switches() so the net solver merges COM with the chosen throw. When COM is wired to a board pin the
 * sketch reads the level of the chosen throw (volts above 2.5 V = HIGH, a floating or grounded throw = LOW), the usual way a slide
 * switch is wired (A to GND, B to 5V). Written from public SS12D00-style behaviour. Pair: scene/parts/slide-switch.ts. Guide: docs/lab-extending.md
 */
import {defineDevice} from './types';
import {uno} from './core/util';

export type SlideSwitchState={position:'A'|'B';toB:boolean;high:boolean;volts:number};

export const device=defineDevice<SlideSwitchState>({
 kind:'slide-switch',protocol:'switch',
 pins:['A','COM','B'],holes:[0,1,2],
 copy:{
  name:{en:'Slide switch (SPDT)',id:'Saklar geser (SPDT)'},
  desc:{en:'A small lever slides between two positions. The middle leg (COM) always touches exactly one of the outer legs, A or B.',id:'Tuas kecil bergeser di antara dua posisi. Kaki tengah (COM) selalu menyentuh tepat satu kaki luar, A atau B.'},
  note:{en:'COM is the middle leg. Wire A to GND and B to 5V, then read COM with a digital input. Click it to slide the lever.',id:'COM adalah kaki tengah. Sambungkan A ke GND dan B ke 5V, lalu baca COM dengan input digital. Klik untuk menggeser tuas.'},
 },
 inputs:[{type:'toggle',key:'toB',label:{en:'Lever on B',id:'Tuas di B'},default:false}],
 defaults:{toB:false},
 create(ctx){
  const com=uno(ctx.net('COM'));
  let last:boolean|null=null,volts=0;
  const sync=():SlideSwitchState=>{
   const toB=ctx.props.toB===true;
   const v=ctx.volts(toB?'B':'A');
   volts=v??0;
   const high=volts>2.5;
   if(com&&(toB!==last||high!==lastHigh)){ctx.env.setPin(com,high);}
   last=toB;lastHigh=high;
   return {position:toB?'B':'A',toB,high,volts:Math.round(volts*10)/10};
  };
  let lastHigh:boolean|null=null;
  let st=sync();
  return {
   state:()=>st=sync(),
   tick(){st=sync();},
   switches:()=>[{a:'COM',b:'A',closed:!st.toB},{a:'COM',b:'B',closed:st.toB}],
  };
 },
});
