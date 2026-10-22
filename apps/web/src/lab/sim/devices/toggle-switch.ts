/**
 * TOGGLE-SWITCH (SPST, protocol switch): a panel toggle with a metal lever and two terminals. Up (ON) the contact joins A and B;
 * down (OFF) it is open. Declared with switches(), so a linked part sees the break. When B is wired to a board pin the sketch reads
 * the level of the A side while the contact is closed (volts above 2.5 V = HIGH); open reads LOW, as with a pull-down resistor.
 * Written from public MTS-101-style behaviour (a mechanical contact, no timing). Pair: scene/parts/toggle-switch.ts. Guide: docs/lab-extending.md
 */
import {defineDevice} from './types';
import {uno} from './core/util';

export type ToggleSwitchState={on:boolean;high:boolean;volts:number};

export const device=defineDevice<ToggleSwitchState>({
 kind:'toggle-switch',protocol:'switch',
 pins:['A','B'],holes:[0,2],
 copy:{
  name:{en:'Toggle switch (SPST)',id:'Saklar toggle (SPST)'},
  desc:{en:'A metal lever that flips up or down. Up joins its two terminals like a closed wire, down breaks the connection.',id:'Tuas logam yang dibalik ke atas atau bawah. Ke atas menyambung dua terminalnya seperti kabel tertutup, ke bawah memutus sambungan.'},
  note:{en:'Put it in series with a load, or wire A to 5V and B to a pin. Click to flip it.',id:'Pasang seri dengan beban, atau sambungkan A ke 5V dan B ke sebuah pin. Klik untuk membaliknya.'},
 },
 inputs:[{type:'toggle',key:'on',label:{en:'Lever up (ON)',id:'Tuas ke atas (ON)'},default:false}],
 defaults:{on:false},
 create(ctx){
  const out=uno(ctx.net('B'));
  let lastHigh:boolean|null=null;
  const sync=():ToggleSwitchState=>{
   const on=ctx.props.on===true;
   const v=on?(ctx.volts('A')??0):0;
   const high=on&&v>2.5;
   if(out&&high!==lastHigh)ctx.env.setPin(out,high);
   lastHigh=high;
   return {on,high,volts:Math.round(v*10)/10};
  };
  let st=sync();
  return {
   state:()=>st=sync(),
   tick(){st=sync();},
   switches:()=>[{a:'A',b:'B',closed:st.on}],
  };
 },
});
