/**
 * TOUCH-TTP223 (protocol switch): single-key capacitive touch module (TTP223-BA6). Digital output only.
 * Public datasheet behaviour modelled here:
 *  - Supply 2.0 to 5.5 V, a few microamps. After power-up it spends about 0.5 s calibrating; touches in that window are ignored.
 *  - Direct mode (module jumper A open): OUT follows the pad. Toggle mode (jumper A closed): every touch flips OUT.
 *  - Output polarity: active HIGH by default, active LOW with jumper B closed. Idle is the opposite level; the output is push-pull.
 *  - Response time from touch (and from release) to the output edge: about 60 ms in fast mode, 220 ms in low-power mode.
 *  - Maximum on-time in direct mode about 100 s: a pad held longer is treated as a drift and the output returns to idle until released.
 * The pad is held from the popover or by pressing the part (a click arrives as a momentary button input).
 * Pair: scene/parts/touch-ttp223.ts (3D). Guide: docs/lab-extending.md
 */
import {defineDevice,ms} from './types';
import {uno} from './core/util';

export type TouchTtp223State={touched:boolean;out:boolean;latched:boolean;ready:boolean;toggleMode:boolean;activeLow:boolean;presses:number};
export const TTP223={settleMs:500,fastMs:60,lowPowerMs:220,maxOnMs:100000} as const;

export const device=defineDevice<TouchTtp223State>({
 kind:'touch-ttp223',protocol:'switch',
 // silkscreen order: I/O, VCC, GND
 pins:['OUT','VCC','GND'],holes:[0,1,2],
 copy:{
  name:{en:'Touch sensor (TTP223)',id:'Sensor sentuh (TTP223)'},
  desc:{en:'A capacitive touch pad. OUT goes HIGH while a finger rests on it (or flips on every touch in toggle mode). It takes about 60 ms to react.',id:'Bantalan sentuh kapasitif. OUT menjadi HIGH selama jari menempel (atau berganti setiap sentuhan di mode toggle). Butuh sekitar 60 ms untuk bereaksi.'},
  note:{en:'Press and hold the pad, or use the panel to hold a touch.',id:'Tekan dan tahan bantalan, atau pakai panel untuk menahan sentuhan.'},
 },
 power:{rail:['VCC','GND'],min:2,max:5.5,ma:0.01},
 inputs:[
  {type:'toggle',key:'touched',label:{en:'Finger on the pad',id:'Jari di bantalan'},default:false},
  {type:'toggle',key:'toggleMode',label:{en:'Toggle mode (jumper A)',id:'Mode toggle (jumper A)'},default:false},
  {type:'toggle',key:'activeLow',label:{en:'Active LOW (jumper B)',id:'Aktif LOW (jumper B)'},default:false},
  {type:'toggle',key:'lowPower',label:{en:'Low-power mode (slow response)',id:'Mode hemat daya (respons lambat)'},default:false},
 ],
 defaults:{touched:false,toggleMode:false,activeLow:false,lowPower:false},
 create(ctx){
  const out=uno(ctx.net('OUT'));
  const t0=ctx.env.now();
  let held=false;           // momentary click from the 3D pad
  let seen=false;           // pad state the chip has acted on (after the response delay)
  let want=false;           // pad state last seen on the electrode
  let latched=false;        // toggle-mode memory
  let onSince=0;            // cycle when the pad output went active (max on-time)
  let ignoring=false,expired=false,presses=0,level:boolean|null=null,gen=0;
  const ready=():boolean=>ctx.env.now()-t0>=ms(TTP223.settleMs);
  const low=():boolean=>ctx.props.activeLow===true;
  const toggle=():boolean=>ctx.props.toggleMode===true;
  const logical=():boolean=>toggle()?latched:(seen&&!expired);   // "active" before polarity
  const drive=():void=>{const lv=logical()?!low():low();if(out&&lv!==level){ctx.env.setPin(out,lv);level=lv;}};
  const resp=():number=>ms(ctx.props.lowPower===true?TTP223.lowPowerMs:TTP223.fastMs);
  const poll=():void=>{
   const pad=held||ctx.props.touched===true;
   // a finger already on the pad while the chip calibrates becomes part of its baseline: no touch until it lifts
   if(!ready()||ignoring){ignoring=pad;if(!ready())return;if(ignoring)return;}
   if(pad!==want){
    want=pad;
    const g=++gen;
    ctx.schedule(resp(),()=>{
     if(g!==gen)return;   // the electrode changed again before the chip answered: the newest change wins
     const was=seen;seen=want;
     if(seen&&!was){presses++;onSince=ctx.env.now();expired=false;if(toggle())latched=!latched;}
     if(!seen){expired=false;}
     drive();
    });
   }
   if(!toggle()&&seen&&!expired&&ctx.env.now()-onSince>=ms(TTP223.maxOnMs)){expired=true;drive();}
  };
  drive();
  return {
   state:()=>{poll();return {touched:want,out:level===true,latched,ready:ready(),toggleMode:toggle(),activeLow:low(),presses};},
   setInput(i){if(i.kind==='button'){held=i.pressed;poll();}},
   tick(){poll();},
  };
 },
});
