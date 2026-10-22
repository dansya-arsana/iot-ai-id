/**
 * REED-SWITCH device (protocol 'switch'): a normally-open reed capsule on a 3-pin module (VCC, SIG, GND) with a pull-down on SIG.
 * Two ferromagnetic blades sealed in glass touch when a magnet's field along the capsule exceeds the pull-in value (typ 100 G, about 10 mT
 * for a 10-20 AT part) and spring apart again below the drop-out value (typ 60 G). A magnet across the capsule couples far less (15%).
 * The blades chatter when they snap shut: this model gives the closing edge a typical 0.2 ms bounce (datasheets quote 0.1..0.5 ms), so
 * a sketch that does not debounce can count a few edges. Closed joins VCC to SIG (SIG reads HIGH), open lets the pull-down hold LOW.
 * Magnet field: B = 2500 G * (5 / (5 + d))^3, d in mm (a small neodymium disc). Pair: scene/parts/reed-switch.ts (3D).
 */
import {defineDevice,clamp,num,us} from './types';
import type {PulsePlan} from './types';
import {uno} from './core/util';

export type ReedSwitchState={distance:number;orient:string;field:number;closed:boolean;high:boolean;bouncing:boolean;edges:number};

export const PULL_IN=100;
export const DROP_OUT=60;
export const ACROSS=0.15;
/** Closing bounce, level and hold per step in microseconds: up, chatter, up, chatter, settled. */
export const BOUNCE_US:readonly [0|1,number][]=[[1,50],[0,30],[1,70],[0,25],[1,0]];

export const device=defineDevice<ReedSwitchState>({
 kind:'reed-switch',protocol:'switch',
 pins:['VCC','SIG','GND'],holes:[0,1,2],
 power:{rail:['VCC','GND'],min:3.3,max:5.5,ma:1},
 copy:{
  name:{en:'Reed switch module',id:'Modul reed switch'},
  desc:{en:'A glass capsule with two metal blades that touch when a magnet comes near. SIG reads HIGH while the contact is closed and LOW otherwise. The closing edge bounces for a moment, like the real thing.',id:'Kapsul kaca dengan dua bilah logam yang bersentuhan saat magnet mendekat. SIG terbaca HIGH saat kontak menutup dan LOW saat terbuka. Tepi penutupan memantul sebentar, seperti aslinya.'},
  note:{en:'Click it to bring a magnet closer. A magnet along the glass works best; across it, it must be much closer.',id:'Klik untuk mendekatkan magnet. Magnet searah kaca paling ampuh; melintang, harus jauh lebih dekat.'},
 },
 inputs:[
  {type:'range',key:'distance',label:{en:'Magnet distance',id:'Jarak magnet'},min:0,max:40,step:0.5,unit:'mm',default:40},
  {type:'choice',key:'orient',label:{en:'Magnet direction',id:'Arah magnet'},options:[{value:'along',label:{en:'Along the glass',id:'Searah kaca'}},{value:'across',label:{en:'Across the glass',id:'Melintang kaca'}}],default:'along'},
 ],
 defaults:{distance:40,orient:'along'},
 create(ctx){
  const sig=uno(ctx.net('SIG'));
  let closed=false,level:boolean|null=null,bouncing=false,edges=0,plan:PulsePlan|null=null;
  // VCC level seen by the contact (null or below 1 V: unpowered, SIG stays pulled low)
  const vcc=()=>{const v=ctx.volts('VCC');return v!==null&&v>1?1:0;};
  const field=()=>{
   const d=clamp(num(ctx.props.distance,40),0,40);
   const orient=ctx.props.orient==='across'?'across':'along';
   return {d,orient,b:2500*Math.pow(5/(5+d),3)*(orient==='along'?1:ACROSS)};
  };
  const put=(l:boolean)=>{if(l!==level){level=l;edges++;if(sig)ctx.env.setPin(sig,l);}};
  const sync=()=>{
   const f=field();
   const was=closed;
   if(!closed&&f.b>=PULL_IN)closed=true;else if(closed&&f.b<DROP_OUT)closed=false;
   const want=closed&&vcc()===1;
   if(closed!==was||(level===null)||(!bouncing&&want!==level)){
    plan?.cancel();bouncing=false;
    if(level===null){level=want;if(sig)ctx.env.setPin(sig,want);}
    else if(want&&!level&&sig){
     // closing: the blades chatter before they settle
     bouncing=true;
     plan=ctx.drive(sig,BOUNCE_US.map(([l,h])=>({level:l,holdCycles:us(h)})),{onDone:()=>{bouncing=false;}});
     level=true;
     // count the physical edges of the bounce train
     edges+=BOUNCE_US.length;
    }else put(want);
   }
   return f;
  };
  sync();
  return {
   state:()=>{const f=sync();return {distance:f.d,orient:f.orient,field:Math.round(f.b),closed,high:level===true,bouncing,edges};},
   tick(){sync();},
   switches:()=>[{a:'VCC',b:'SIG',closed}],
  };
 },
});
