/**
 * Live demos for the parts gallery (hover a card and the part comes alive). No firmware runs here: a demo drives the REAL device model of the kind
 * with a fake clock, sweeping the same `inputs` its popover offers (a potentiometer turns, a joystick tilts, keypad keys tap, a relay clicks), and for
 * the output-only builtins (LED, buzzer, motor, servo) and for displays that a sketch would normally fill it supplies the state a sketch would
 * produce (a pattern on the glass, pixels cycling a rainbow). `createDemo(kind)` returns state(tMs) or null when a kind has nothing to show.
 */
import type {PartInput,PartState,PartProps,Circuit,UnoPin} from '../../contract';
import {UNO_PINS} from '../../contract';
import {deviceRegistry} from '../../sim/devices';
import {createModels,EMPTY} from '../../sim/peripherals';
import type {Env} from '../../sim/devices/types';

type V=Record<string,number|boolean|string|null>;
const TAU=Math.PI*2;
/** 0..1 triangle-ish smooth sweep with the given period (s). */
const sweep=(t:number,period:number,phase=0):number=>0.5-0.5*Math.cos(TAU*(t/period+phase));
const hexByte=(n:number):string=>(n&255).toString(16).padStart(2,'0');
const hue=(h:number):string=>{const f=(n:number):number=>{const k=(n+h*6)%6;return Math.round(255*(1-Math.max(0,Math.min(k,4-k,1))));};return hexByte(f(5))+hexByte(f(3))+hexByte(f(1));};

/** Builtins whose state is a plain PartState (their devices only react to board pins, which a gallery card does not have). */
const STATIC:Record<string,(t:number)=>PartState>={
 led:t=>{const b=sweep(t,2);return {kind:'led',brightness:b,on:b>0.04,currentMa:b*12,overCurrent:false};},
 'rgb-led':t=>({kind:'rgb-led',r:sweep(t,3),g:sweep(t,3,1/3),b:sweep(t,3,2/3)}),
 buzzer:t=>({kind:'buzzer',on:Math.floor(t*2)%2===0,freqHz:440+220*Math.floor(t)%3}),
 motor:t=>{const d=sweep(t,4);return {kind:'motor',duty:d,rpm:Math.round(d*6000)};},
 servo:t=>{const a=sweep(t,3)*180;return {kind:'servo',pulseUs:Math.round(1000+a/180*1000),angleDeg:a};},
 button:t=>({kind:'button',pressed:Math.floor(t*1.5)%2===1}),
 potentiometer:t=>({kind:'potentiometer',value:Math.round(sweep(t,4)*1023)}),
};

/** Glass patterns for displays: what a sketch would have drawn. Each takes the model's idle state and returns the demo state. */
const DISPLAY:Record<string,(s:V,t:number)=>V>={
 'lcd1602-i2c':(s,t)=>({...s,display:true,backlight:true,cursor:false,blink:false,col:-1,contrast:60,line1:'Hello, AIoT Lab!'.padEnd(16),line2:`t=${t.toFixed(1)} s`.padEnd(16)}),
 'lcd2004-i2c':(s,t)=>({...s,display:true,backlight:true,cursor:false,blink:false,col:-1,contrast:60,line1:'AIoT Lab  LCD 20x4'.padEnd(20),line2:`Temp   ${(24+sweep(t,6)*3).toFixed(1)} C`.padEnd(20),line3:`Humid  ${Math.round(55+sweep(t,8)*10)} %`.padEnd(20),line4:`Uptime ${Math.floor(t)} s`.padEnd(20)}),
 'oled-ssd1306':(s,t)=>{
  const fb=new Uint8Array(1024);
  const set=(x:number,y:number):void=>{if(x>=0&&x<128&&y>=0&&y<64)fb[(y>>3)*128+x]|=1<<(y&7);};
  for(let x=0;x<128;x++){set(x,0);set(x,63);}for(let y=0;y<64;y++){set(0,y);set(127,y);}
  for(let x=2;x<126;x++)set(x,Math.round(32+22*Math.sin(x/9+t*3)));
  return {...s,on:true,contrast:200,fb:Array.from(fb,hexByte).join('')};
 },
 'nokia5110-pcd8544':(s,t)=>{
  const fb=new Uint8Array(504);
  const set=(x:number,y:number):void=>{if(x>=0&&x<84&&y>=0&&y<48)fb[(y>>3)*84+x]|=1<<(y&7);};
  for(let x=0;x<84;x++){set(x,0);set(x,47);}for(let y=0;y<48;y++){set(0,y);set(83,y);}
  for(let x=2;x<82;x++)set(x,Math.round(24+16*Math.sin(x/7+t*3)));
  return {...s,power:true,display:'normal',vlcd:6.9,light:1,fb:Array.from(fb,hexByte).join('')};
 },
 'max7219-matrix':(s,t)=>{
  const n=Number(s.modules)||1,pos=Math.floor(t*8);
  let fb='';
  for(let m=0;m<n;m++)for(let r=0;r<8;r++)fb+=hexByte(1<<(7-(((pos+r+m*3)%14)>7?13-((pos+r+m*3)%14):(pos+r+m*3)%14)));
  return {...s,selected:true,fb,lum:Array.from({length:n},()=>'c0').join('')};
 },
 'tm1637-4digit':(s,t)=>{
  const G=[0x3f,0x06,0x5b,0x4f,0x66,0x6d,0x7d,0x07,0x7f,0x6f],n=Math.floor(t*2)%10000,d=[Math.floor(n/1000)%10,Math.floor(n/100)%10,Math.floor(n/10)%10,n%10];
  const colon=Math.floor(t*2)%2===0;
  const seg=d.map((x,i)=>hexByte(G[x]!|(i===1&&colon?0x80:0))).join('')+'0000';
  return {...s,seg,text:d.join(''),colon,on:true,bright:7,duty:0.9};
 },
 'seven-segment':(s,t)=>{
  const G=[0x3f,0x06,0x5b,0x4f,0x66,0x6d,0x7d,0x07,0x7f,0x6f],g=G[Math.floor(t*1.5)%10]!;
  const o:V={...s,glyph:String(Math.floor(t*1.5)%10)};
  ['a','b','c','d','e','f','g'].forEach((k,i)=>{const on=(g>>i)&1;o[k]=on;o['ma_'+k]=on?8:0;});
  return o;
 },
 'led-bar-10':(s,t)=>{
  const lit=Math.round(sweep(t,3)*10),o:V={...s,lit,level:lit};
  for(let i=1;i<=10;i++)o['s'+i]=i<=lit?1:0;
  return o;
 },
 'ws2812-strip':(s,t)=>{
  const n=Number(s.count)||8;let leds='';
  for(let i=0;i<n;i++)leds+=hue((i/n+t*0.25)%1);
  return {...s,leds,frames:1};
 },
 'relay-module':(s,t)=>{const on=Math.floor(t*0.8)%2===1;return {...s,energized:on,commanded:on,ledOn:on,comTo:on?'NO':'NC',powered:true};},
 'hc05-bluetooth':(s,t)=>{
  const k=Math.floor(t*0.8)%4;
  const rows=['< hello from the board','> LED ON','< LED is on','> LED OFF'].slice(0,k+1);
  return {...s,connected:true,powered:true,transcript:rows.join('\n')};
 },
};

/** A fake board: a clock with scheduled callbacks, enough for a device model to run its timers. */
function fakeEnv(){
 const events:{at:number;cb:()=>void}[]=[];
 let now=0;
 const levels=new Map<UnoPin,boolean>();
 const env:Env={
  setPin:(p,l)=>{levels.set(p,l);},setAdc:()=>undefined,
  schedule:(c,cb)=>{events.push({at:now+c,cb});events.sort((a,b)=>a.at-b.at);},now:()=>now,
  pinLevel:p=>(levels.get(p)?1:0),watchLine:()=>undefined,tapUart:()=>undefined,uartSend:()=>undefined,
 };
 return {env,run(to:number){while(events.length&&events[0]!.at<=to){const e=events.shift()!;now=e.at;e.cb();}now=to;}};
}

/** A device model on a fake board: no firmware, just the model, a clock and its popover props. Null for a kind without a device. */
export interface Harness{
 readonly kind:string;
 /** the model's live props (what the popover edits) */
 readonly props:PartProps;
 /** advance the fake clock to tMs and return the model's state */
 step(tMs:number):PartState;
 input(i:PartInput):void;
 /** set one popover prop */
 set(key:string,value:string|number|boolean):void;
}
export function createHarness(kind:string):Harness|null{
 const def=deviceRegistry.get(kind);
 if(!def)return null;
 const f=fakeEnv();
 const net:Record<string,string>={};
 def.pins.forEach((p,i)=>{net[p]=UNO_PINS[i%UNO_PINS.length]!;});
 const circuit:Circuit={wires:[],parts:[{id:'demo',kind,net:net as never,props:{...(def.defaults??{})}}]};
 let model;
 try{model=createModels(circuit,f.env).get('demo');}catch{return null;}
 if(!model)return null;
 const m=model;
 let lastMs=0;
 return {
  kind,props:m.props,
  step(tMs){
   const cycles=Math.round(tMs*16000);
   f.run(cycles);
   m.update({samples:EMPTY(),dtSec:Math.max(0.001,(tMs-lastMs)/1000),cycles});
   lastMs=tMs;
   return m.state();
  },
  input(i){m.setInput(i);},
  set(key,value){(m.props as PartProps)[key]=value;},
 };
}

/** state(tMs) for a hover demo of `kind`, or null when there is nothing to animate. */
export function createDemo(kind:string):((tMs:number)=>PartState)|null{
 const st=STATIC[kind];
 if(st)return tMs=>st(tMs/1000);
 const def=deviceRegistry.get(kind);
 const h=createHarness(kind);
 if(!def||!h)return null;
 const tapped=new Map<string,number>();
 const patch=DISPLAY[kind];
 return tMs=>{
  const t=tMs/1000;
  // sweep the popover inputs: ranges glide, toggles flip, choices step; momentary choices (keypad) tap and release
  def.inputs.forEach((inp,i)=>{
   if(inp.advanced||inp.type==='terminal')return;
   const props=h.props;
   if(inp.type==='range')props[inp.key]=Math.round((inp.min+(inp.max-inp.min)*sweep(t,5+i,i*0.31))/inp.step)*inp.step;
   else if(inp.type==='toggle')props[inp.key]=Math.floor(t/(1.6+i*0.4))%2===1?!inp.default:inp.default;
   else if(inp.type==='choice'){
    const opts=inp.options.map(o=>o.value);
    if(inp.momentaryMs){
     const slot=Math.floor(t/0.7),start=slot*0.7;
     const v=t-start<inp.momentaryMs/1000?opts[(slot*5)%Math.max(1,opts.length-1)]!:inp.default;
     if(tapped.get(inp.key)!==slot||v===inp.default)props[inp.key]=v;
     tapped.set(inp.key,slot);
    }
    else if(!inp.fold&&opts.length>1)props[inp.key]=opts[Math.floor(t/1.4+i)%opts.length]!;
   }
  });
  const s=h.step(tMs);
  if(patch&&s.kind==='ext')return {...s,v:patch(s.v as V,t)};
  return s;
 };
}
