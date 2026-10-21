import {INPUT_RANGES,SIM_CLOCK_HZ,UNO_PINS} from '../contract';
import type {Circuit,CreateLabRunner,FirmwareVariant,LabRunner,LoadReport,ParamValues,PartInput,PartProps,PartState,PinSample,SimSnapshot,SimStatus,UnoPin} from '../contract';
import {buildLineIndex,decodeFlash,patchFlash,toProgramWords} from './flash';
import {AvrMachine} from './machine';
import {createModels} from './peripherals';
import type {PartModel} from './peripherals';

const CYCLES_PER_MS=SIM_CLOCK_HZ/1000;
const SERIAL_KEEP=65536;
const TX_WINDOW=SIM_CLOCK_HZ*0.03;

const idleSamples=():Record<UnoPin,PinSample>=>{
 const o={} as Record<UnoPin,PinSample>;
 for(const p of UNO_PINS)o[p]={mode:'input',level:0,duty:0,freqHz:0,highUs:0,analog:null};
 return o;
};

export const createLabRunner:CreateLabRunner=():LabRunner=>{
 let status:SimStatus='idle';
 let error:string|null=null;
 let machine:AvrMachine|null=null;
 let models=new Map<string,PartModel>();
 let samples=idleSamples();
 let speed=1;
 let lastTx=-1;
 let serial='';
 let pending='';
 const listeners=new Set<(c:string)=>void>();
 const inputs=new Map<string,PartInput>();

 const cycles=()=>machine?machine.cpu.cycles:0;
 const clampInput=(i:PartInput):PartInput=>{
  if(i.kind==='potentiometer')return {kind:i.kind,value:Math.min(INPUT_RANGES.potentiometer.max,Math.max(0,Math.round(i.value)))};
  return i;
 };

 function sampleAll(ws:number,we:number,dtSec:number):void{
  if(!machine)return;
  const next={} as Record<UnoPin,PinSample>;
  for(const p of UNO_PINS)next[p]=machine.monitor.sample(p,ws,we);
  const frame={samples:next,dtSec,cycles:we};
  for(const m of models.values())m.update(frame);
  for(const m of models.values()){const a=m.analog?.();if(a)next[a.pin].analog=a.adc;}
  samples=next;
 }
 function flushSerial():void{
  if(!pending)return;
  const chunk=pending;pending='';
  for(const cb of [...listeners])cb(chunk);
 }
 function snapshot():SimSnapshot{
  const parts:Record<string,PartState>={};
  for(const [id,m] of models)parts[id]=m.state();
  const c=cycles();
  return {
   status,error,simTimeMs:c/CYCLES_PER_MS,speed,pins:samples,parts,
   currentLine:machine&&machine.line>0?machine.line:null,
   txActive:lastTx>=0&&c-lastTx<TX_WINDOW,
  };
 }
 function drop():void{machine=null;models=new Map();samples=idleSamples();}

 return {
  load(variant:FirmwareVariant,params:ParamValues,circuit:Circuit,toolchain:string):LoadReport{
   try{
    const {bytes,patched}=patchFlash(decodeFlash(variant.flashBase64),variant.params,params);
    const m=new AvrMachine(toProgramWords(bytes),buildLineIndex(variant.lines));
    drop();
    machine=m;serial='';pending='';lastTx=-1;speed=1;
    const dec=new TextDecoder('utf-8');
    m.usart.onByteTransmit=b=>{const s=dec.decode(new Uint8Array([b]),{stream:true});serial+=s;pending+=s;lastTx=m.cpu.cycles;if(serial.length>SERIAL_KEEP*2)serial=serial.slice(-SERIAL_KEEP);};
    models=createModels(circuit,{
     setPin:(p,l)=>m.setPin(p,l),
     setAdc:(ch,v)=>m.setAdc(ch,v),
     schedule:(c,cb)=>m.schedule(c,cb),
     now:()=>m.cpu.cycles,
    });
    const edgeModels=[...models.values()].filter(x=>x.onEdge);
    m.monitor.onEdge=(pin,level,cycle)=>{for(const x of edgeModels)x.onEdge!(pin,level,cycle);};
    for(const [id,i] of inputs)models.get(id)?.setInput(i);
    status='stopped';error=null;
    sampleAll(0,0,0);
    return {sketch:variant.sketch,bytes:variant.bytes,toolchain,patched};
   }catch(e){
    status='error';error=e instanceof Error?e.message:String(e);
    throw e;
   }
  },
  start(){if(status==='stopped')status='running';},
  stop(){if(status==='running')status='stopped';},
  tick(wallMs:number){
   if(status!=='running'||!machine)return snapshot();
   const before=machine.cpu.cycles;
   const want=Math.max(0,Math.min(wallMs,50))*CYCLES_PER_MS;
   if(want>0){
    machine.run(before+want,performance.now()+12);
    const done=machine.cpu.cycles-before;
    speed=speed*0.8+0.2*(done/want);
    sampleAll(before,machine.cpu.cycles,done/SIM_CLOCK_HZ);
   }
   flushSerial();
   return snapshot();
  },
  advance(simMs:number){
   if(status!=='running'||!machine)return snapshot();
   const end=machine.cpu.cycles+Math.round(simMs*CYCLES_PER_MS);
   while(machine.cpu.cycles<end){
    const before=machine.cpu.cycles;
    machine.run(Math.min(end,before+CYCLES_PER_MS),null);
    const now=machine.cpu.cycles;
    sampleAll(before,now,(now-before)/SIM_CLOCK_HZ);
   }
   flushSerial();
   return snapshot();
  },
  snapshot,
  setInput(partId:string,input:PartInput){
   const i=clampInput(input);
   inputs.set(partId,i);
   models.get(partId)?.setInput(i);
   if(machine)sampleAll(machine.cpu.cycles,machine.cpu.cycles,0);
  },
  setPartProps(partId:string,props:PartProps){
   const m=models.get(partId);
   if(m)Object.assign(m.props,props);
  },
  onSerial(cb){listeners.add(cb);return ()=>{listeners.delete(cb);};},
  serialText(){return serial.length>SERIAL_KEEP?serial.slice(-SERIAL_KEEP):serial;},
  dispose(){drop();listeners.clear();inputs.clear();serial='';pending='';status='idle';error=null;},
 };
};
