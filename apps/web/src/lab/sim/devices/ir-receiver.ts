/**
 * IR-RECEIVER device (protocol 'pulse'): VS1838B-class 38 kHz demodulating IR receiver, with a virtual NEC remote.
 * The module already strips the 38 kHz carrier: OUT idles HIGH and goes LOW while a burst of carrier is received.
 * So the sketch sees the demodulated NEC protocol (public spec) exactly as an IRremote or hand-written decoder expects:
 *  - Leader: 9 ms mark (OUT LOW) + 4.5 ms space (HIGH).
 *  - 32 bits, each a 562.5 us mark then a space: 562.5 us = 0, 1687.5 us = 1. Order: address, ~address, command, ~command, LSB first.
 *  - A final 562.5 us mark ends the frame.
 *  - Held key: a repeat code every 108 ms measured from the start of the previous frame: 9 ms mark, 2.25 ms space, 562.5 us mark.
 * The popover has a 21-key remote. Choosing a key sends one press; with "Hold key" on it keeps sending repeat codes.
 * Pair: scene/parts/ir-receiver.ts (3D). Guide: docs/lab-extending.md
 */
import {defineDevice,us,ms,type Pulse} from './types';
import {uno} from './core/util';

export type IrReceiverState={out:boolean;receiving:boolean;button:string;address:number;command:number;frames:number;repeats:number};

/** Remote keys and their NEC command bytes (address 0x00), the common 21-key mini remote layout. */
export const KEYS:readonly {key:string;cmd:number}[]=[
 {key:'ch-',cmd:0x45},{key:'ch',cmd:0x46},{key:'ch+',cmd:0x47},
 {key:'prev',cmd:0x44},{key:'next',cmd:0x40},{key:'play',cmd:0x43},
 {key:'vol-',cmd:0x07},{key:'vol+',cmd:0x15},{key:'eq',cmd:0x09},
 {key:'0',cmd:0x16},{key:'100+',cmd:0x19},{key:'200+',cmd:0x0D},
 {key:'1',cmd:0x0C},{key:'2',cmd:0x18},{key:'3',cmd:0x5E},
 {key:'4',cmd:0x08},{key:'5',cmd:0x1C},{key:'6',cmd:0x5A},
 {key:'7',cmd:0x42},{key:'8',cmd:0x52},{key:'9',cmd:0x4A},
];
export const NEC={mark:562.5,zero:562.5,one:1687.5,leaderMark:9000,leaderSpace:4500,repeatSpace:2250,period:108000};
const T=(micro:number):number=>us(micro);

/** Demodulated NEC frame as OUT levels: LOW = carrier present. Ends back at idle HIGH. */
export function necFrame(address:number,command:number):Pulse[]{
 const p:Pulse[]=[{level:0,holdCycles:T(NEC.leaderMark)},{level:1,holdCycles:T(NEC.leaderSpace)}];
 const bytes=[address&255,~address&255,command&255,~command&255];
 for(const b of bytes)for(let i=0;i<8;i++){
  p.push({level:0,holdCycles:T(NEC.mark)},{level:1,holdCycles:T((b>>i&1)?NEC.one:NEC.zero)});
 }
 p.push({level:0,holdCycles:T(NEC.mark)},{level:1,holdCycles:0});
 return p;
}
export const necRepeat=():Pulse[]=>[{level:0,holdCycles:T(NEC.leaderMark)},{level:1,holdCycles:T(NEC.repeatSpace)},{level:0,holdCycles:T(NEC.mark)},{level:1,holdCycles:0}];
const total=(p:readonly Pulse[]):number=>p.reduce((a,x)=>a+x.holdCycles,0);

export const device=defineDevice<IrReceiverState>({
 kind:'ir-receiver',protocol:'pulse',
 // physical order seen from the dome: OUT, GND, VCC
 pins:['OUT','GND','VCC'],holes:[0,1,2],
 copy:{
  name:{en:'IR receiver (VS1838B)',id:'Penerima IR (VS1838B)'},
  desc:{en:'A 38 kHz infrared receiver. It removes the carrier, so OUT idles HIGH and pulses LOW with the remote NEC bursts that a decoder sketch can time.',id:'Penerima inframerah 38 kHz. Pembawa dibuang, sehingga OUT diam di HIGH dan berdenyut LOW mengikuti burst NEC remote yang bisa diukur sketch dekoder.'},
  note:{en:'Pick a remote key in the panel to send a real NEC frame.',id:'Pilih tombol remote di panel untuk mengirim frame NEC asli.'},
 },
 inputs:[
  {type:'choice',key:'button',label:{en:'Remote key',id:'Tombol remote'},options:[{value:'none',label:{en:'(release)',id:'(lepas)'}},...KEYS.map(k=>({value:k.key,label:{en:k.key.toUpperCase(),id:k.key.toUpperCase()}}))],default:'none'},
  {type:'toggle',key:'hold',label:{en:'Hold key (repeat codes)',id:'Tahan tombol (kode ulang)'},default:false},
 ],
 defaults:{button:'none',hold:false},
 create(ctx){
  const out=uno(ctx.net('OUT'));
  let level=true,busy=false,frames=0,repeats=0,btn='none',addr=0,cmd=0,held=false,lastLen=0;
  const set=(l:boolean):void=>{level=l;};
  if(out)ctx.env.setPin(out,true);
  const play=(p:Pulse[],delay:number,done:()=>void):void=>{
   busy=true;
   // mirror the level for state(); the pulses themselves are scheduled by the host
   if(out)ctx.drive(out,p,{delayCycles:delay,onDone:()=>{busy=false;set(true);done();}});
   else ctx.schedule(delay+total(p),()=>{busy=false;done();});
   lastLen=total(p);
   let at=delay;for(const x of p){const lv=x.level===1;ctx.schedule(at,()=>set(lv));at+=x.holdCycles;}
  };
  const repeat=():void=>{
   // 108 ms between frame STARTS: wait out the rest of the period, then a repeat code while the key stays down
   if(!(held&&ctx.props.hold===true&&ctx.props.button!=='none')){held=false;ctx.props.button='none';btn='none';return;}
   const gap=Math.max(0,ms(NEC.period/1000)-lastLen);
   const p=necRepeat();repeats++;
   play(p,gap,repeat);
  };
  return {
   state:()=>({out:level,receiving:!level,button:btn,address:addr,command:cmd,frames,repeats}),
   tick(){
    const b=String(ctx.props.button??'none');
    if(b==='none'||busy)return;
    const k=KEYS.find(x=>x.key===b);
    if(!k){ctx.props.button='none';return;}
    btn=b;addr=0;cmd=k.cmd;frames++;held=ctx.props.hold===true;
    const p=necFrame(addr,cmd);
    play(p,0,()=>{
     if(held)repeat();
     else{ctx.props.button='none';}   // key released: the next press can be sent
    });
   },
  };
 },
});
