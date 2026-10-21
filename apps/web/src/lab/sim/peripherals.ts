import {ADC_CHANNEL,INPUT_RANGES,MOTOR_MAX_RPM,SIM_CLOCK_HZ,UNO_PINS} from '../contract';
import type {BoardPin,Circuit,PartInput,PartProps,PartSpec,PartState,PinSample,UnoPin} from '../contract';

/** Hooks a part model uses to act on the board. */
export interface Env{
 setPin(pin:UnoPin,level:boolean):void;
 setAdc(channel:number,volts:number):void;
 /** Run cb after `cycles` CPU cycles. */
 schedule(cycles:number,cb:()=>void):void;
 now():number;
}
export interface Frame{samples:Record<UnoPin,PinSample>;dtSec:number;cycles:number;}
export interface PartModel{
 readonly spec:PartSpec;
 props:PartProps;
 state():PartState;
 update(f:Frame):void;
 onEdge?(pin:UnoPin,level:0|1,cycle:number):void;
 setInput(i:PartInput):void;
 analog?():{pin:UnoPin;adc:number}|null;
}

const UNO=new Set<string>(UNO_PINS);
const uno=(p:BoardPin|undefined):UnoPin|null=>p&&UNO.has(p)?p as UnoPin:null;
const num=(v:unknown,d:number):number=>typeof v==='number'&&Number.isFinite(v)?v:d;
const clamp=(v:number,lo:number,hi:number)=>Math.min(hi,Math.max(lo,v));
const round1=(v:number)=>Math.round(v*10)/10;
/** Output duty of a board net. Rails are constant; input pins are not driven. */
function duty(net:BoardPin|undefined,f:Frame):number{
 if(net==='5V'||net==='VIN')return 1;
 const p=uno(net);
 if(!p)return 0;
 const s=f.samples[p];
 return s.mode==='output'?s.duty:0;
}
const freq=(net:BoardPin|undefined,f:Frame):number=>{const p=uno(net);return p?f.samples[p].freqHz:0;};

export const LED_VF:Record<string,number>={red:2.0,yellow:2.1,green:2.2,blue:3.0,white:3.0};

export function createModels(circuit:Circuit,env:Env):Map<string,PartModel>{
 const models=new Map<string,PartModel>();
 const all=()=>[...models.values()];
 for(const spec of circuit.parts){
  const props:PartProps={...spec.props};
  const m=build(spec,props,env,all);
  models.set(spec.id,m);
 }
 for(const m of models.values())m.update({samples:EMPTY(),dtSec:0,cycles:env.now()});
 return models;
}

/** A frame sample set with every pin idle; used for initial settling. */
export function EMPTY():Record<UnoPin,PinSample>{
 const o={} as Record<UnoPin,PinSample>;
 for(const p of UNO_PINS)o[p]={mode:'input',level:0,duty:0,freqHz:0,highUs:0,analog:null};
 return o;
}

function build(spec:PartSpec,props:PartProps,env:Env,all:()=>PartModel[]):PartModel{
 const base={spec,props};
 const noInput=():void=>{};
 switch(spec.kind){
  case 'led':{
   let st:PartState={kind:'led',brightness:0,on:false,currentMa:0,overCurrent:false};
   return {...base,state:()=>st,setInput:noInput,update(f){
    const r=all().find(m=>m.spec.kind==='resistor'&&m.props.seriesWith===spec.id);
    const R=Math.max(1,num(r?.props.ohms,220));
    const vf=LED_VF[String(props.color)]??2.0;
    const I=Math.max(0,(5-vf)/R);
    const d=duty(spec.net.A,f);
    const brightness=d*Math.min(1,I/0.012);
    st={kind:'led',brightness,on:brightness>0.05,currentMa:round1(I*1000*d),overCurrent:I>0.03&&d>0};
   }};
  }
  case 'rgb-led':{
   let st:PartState={kind:'rgb-led',r:0,g:0,b:0};
   return {...base,state:()=>st,setInput:noInput,update(f){st={kind:'rgb-led',r:duty(spec.net.R,f),g:duty(spec.net.G,f),b:duty(spec.net.B,f)};}};
  }
  case 'button':{
   let pressed=false;
   const apply=()=>{const p=uno(spec.net['2']);if(p)env.setPin(p,pressed);};
   apply();
   return {...base,state:()=>({kind:'button',pressed}),update(){},setInput(i){if(i.kind==='button'){pressed=i.pressed;apply();}}};
  }
  case 'potentiometer':{
   let value=clamp(Math.round(num(props.value,512)),INPUT_RANGES.potentiometer.min,INPUT_RANGES.potentiometer.max);
   const pin=uno(spec.net.SIG);
   const apply=()=>{props.value=value;const ch=pin?ADC_CHANNEL[pin]:undefined;if(ch!==undefined)env.setAdc(ch,value/1023*5);};
   apply();
   return {...base,state:()=>({kind:'potentiometer',value}),update(){},setInput(i){if(i.kind==='potentiometer'){value=clamp(Math.round(i.value),0,1023);apply();}},
    analog:()=>pin?{pin,adc:value}:null};
  }
  case 'ldr':{
   const pin=uno(spec.net.B);
   let lux=5,adc=0;
   const calc=()=>{
    const lamp=all().find(m=>m.spec.kind==='lamp'&&m.props.target===spec.id);
    const on=!!lamp&&lamp.props.on===true;
    const dist=clamp(num(lamp?.props.distanceCm,40),INPUT_RANGES.lamp.min,INPUT_RANGES.lamp.max);
    lux=5+(on?600*(30/dist)**2:0);
    const rLdr=clamp(70000*(lux/10)**-0.7,200,1e6);
    const fixed=num(props.fixedOhms,10000);
    const volts=5*fixed/(fixed+rLdr);
    adc=Math.round(volts/5*1023);
    const ch=pin?ADC_CHANNEL[pin]:undefined;
    if(ch!==undefined)env.setAdc(ch,volts);
   };
   return {...base,state:()=>({kind:'ldr',lux,adc}),setInput:noInput,update(){calc();},analog:()=>pin?{pin,adc}:null};
  }
  case 'lamp':{
   props.distanceCm=clamp(num(props.distanceCm,40),INPUT_RANGES.lamp.min,INPUT_RANGES.lamp.max);
   props.on=props.on===true;
   return {...base,state:()=>({kind:'lamp',distanceCm:props.distanceCm as number,on:props.on as boolean}),update(){},setInput(i){
    if(i.kind!=='lamp')return;
    if(i.distanceCm!==undefined)props.distanceCm=clamp(i.distanceCm,INPUT_RANGES.lamp.min,INPUT_RANGES.lamp.max);
    if(i.on!==undefined)props.on=i.on;
   }};
  }
  case 'obstacle':{
   props.distanceCm=clamp(num(props.distanceCm,100),INPUT_RANGES.obstacle.min,INPUT_RANGES.obstacle.max);
   return {...base,state:()=>({kind:'obstacle',distanceCm:props.distanceCm as number}),update(){},setInput(i){
    if(i.kind==='obstacle')props.distanceCm=clamp(i.distanceCm,INPUT_RANGES.obstacle.min,INPUT_RANGES.obstacle.max);
   }};
  }
  case 'hcsr04':{
   const trig=uno(spec.net.TRIG),echo=uno(spec.net.ECHO);
   let rise=0,busy=false,lastTrig=-Infinity,nowCycles=0;
   const target=()=>all().find(m=>m.spec.kind==='obstacle'&&m.props.target===spec.id);
   const dist=():number|null=>{const t=target();return t?num(t.props.distanceCm,0):null;};
   return {...base,setInput:noInput,
    state:()=>{const d=dist();return {kind:'hcsr04',pinging:nowCycles-lastTrig<SIM_CLOCK_HZ*0.1,echoCm:d!==null&&d<=400?d:null};},
    update(f){nowCycles=f.cycles;},
    onEdge(pin,level,cycle){
     if(pin!==trig||!echo)return;
     if(level===1){rise=cycle;return;}
     if(cycle-rise<160||busy)return;
     busy=true;lastTrig=cycle;
     env.schedule(4000,()=>{
      const d=dist();
      const width=d!==null&&d<=400?(Math.round(d*58)+29)*16:Math.round(SIM_CLOCK_HZ*0.038);
      env.setPin(echo,true);
      env.schedule(width,()=>{env.setPin(echo,false);busy=false;});
     });
    }};
  }
  case 'buzzer':{
   let st:PartState={kind:'buzzer',on:false,freqHz:0};
   return {...base,state:()=>st,setInput:noInput,update(f){const hz=freq(spec.net['+'],f);st={kind:'buzzer',on:hz>20,freqHz:hz};}};
  }
  case 'motor':{
   let d=0,rpm=0;
   return {...base,setInput:noInput,state:()=>({kind:'motor',duty:d,rpm}),update(f){
    d=duty(spec.net.DRIVE,f);
    rpm+=(d*MOTOR_MAX_RPM-rpm)*(1-Math.exp(-f.dtSec/0.35));
   }};
  }
  case 'servo':{
   let pulseUs=0,angle=90;
   return {...base,setInput:noInput,state:()=>({kind:'servo',pulseUs,angleDeg:angle}),update(f){
    const p=uno(spec.net.SIG);
    const s=p?f.samples[p]:null;
    pulseUs=s&&s.freqHz>0&&s.highUs>=400&&s.highUs<=2600?s.highUs:0;
    if(pulseUs>0){
     const target=clamp((pulseUs-544)/(2400-544)*180,0,180);
     const step=400*f.dtSec;
     angle=Math.abs(target-angle)<=step?target:angle+Math.sign(target-angle)*step;
    }
   }};
  }
  default:
   return {...base,state:()=>({kind:'passive'}),setInput:noInput,update(){}};
 }
}
