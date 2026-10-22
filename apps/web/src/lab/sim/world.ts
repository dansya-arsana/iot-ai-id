/**
 * The circuit as seen by its devices: part-to-part nets (Circuit.links), net voltages and power checks.
 * One World per loaded circuit. Devices reach it through DeviceCtx (peers, volts, supply); the runner reads notes() for the HUD.
 * Solving is lazy and cached: every device update invalidates, the next question re-solves.
 */
import {PART_PINS} from '../contract';
import type {Circuit} from '../contract';
import {partCopy} from '../parts-copy';
import {PowerNetwork,checkPower} from './power';
import type {PowerNote,PowerPartInfo} from './power';
import {deviceRegistry} from './devices';
import type {Frame,PeerRef} from './devices';
import type {PartModel} from './peripherals';

export class World{
 private frame:Frame|null=null;
 private net:PowerNetwork|null=null;
 private readonly groups:string[][];
 private readonly staticNet:PowerNetwork;
 private readonly kindOf=new Map<string,string>();
 constructor(private circuit:Circuit,private models:()=>readonly PartModel[]){
  this.groups=[];
  for(const p of circuit.parts){
   this.kindOf.set(p.id,p.kind);
   for(const [pin,b] of Object.entries(p.net))if(b)this.groups.push([`P:${p.id}.${pin}`,`B:${b}`]);
  }
  for(const l of circuit.links??[])this.groups.push([`P:${l.a.part}.${l.a.pin}`,`P:${l.b.part}.${l.b.pin}`]);
  this.staticNet=new PowerNetwork({groups:this.groups,parts:[]});
 }
 setFrame(f:Frame):void{this.frame=f;this.net=null;}
 invalidate():void{this.net=null;}

 private info():PowerPartInfo[]{
  const out:PowerPartInfo[]=[];
  for(const m of this.models()){
   const pins=PART_PINS[m.spec.kind]??[];
   const drives:{pin:string;drive:NonNullable<ReturnType<NonNullable<PartModel['output']>>>}[]=[];
   if(m.output)for(const pin of pins){const d=m.output(pin);if(d)drives.push({pin,drive:d});}
   out.push({id:m.spec.id,kind:m.spec.kind,props:m.props,supplies:m.supplies?.()??[],regulators:m.regulators?.()??[],drives,switches:m.switches?.()??[]});
  }
  return out;
 }
 private solved():PowerNetwork{
  if(this.net)return this.net;
  const f=this.frame;
  this.net=new PowerNetwork({
   groups:this.groups,parts:this.info(),vinIdle:4.7,
   io:pin=>{const s=f?.samples[pin as keyof Frame['samples']];return s&&s.mode==='output'?s.duty*5:null;},
  });
  return this.net;
 }

 peers(part:string,pin:string):PeerRef[]{
  const out:PeerRef[]=[];
  for(const n of this.staticNet.peers(`P:${part}.${pin}`)){
   const m=/^P:([^.]+)\.(.+)$/.exec(n);
   if(m&&m[1]!==part)out.push({part:m[1]!,kind:this.kindOf.get(m[1]!)??'',pin:m[2]!});
  }
  return out;
 }
 /** Voltage of the net of a part pin (null: floating). */
 volts(part:string,pin:string):number|null{return this.solved().volts(`P:${part}.${pin}`);}
 /** Voltage across the declared power rail of a part (null: not wired). */
 supply(part:string):number|null{
  const pw=deviceRegistry.get(this.kindOf.get(part)??'')?.power;
  if(!pw)return null;
  const a=this.volts(part,pw.rail[0]),b=this.volts(part,pw.rail[1]);
  return a===null||b===null?null:a-b;
 }
 /** Friendly warnings about every part's supply right now. */
 notes():PowerNote[]{
  const parts=this.circuit.parts.map(p=>{
   const c=partCopy(p.kind).name;
   const def=deviceRegistry.get(p.kind);
   return {id:p.id,kind:p.kind,label:{en:`${c.en} (${p.id})`,id:`${c.id} (${p.id})`},...(def?.power?{power:def.power}:{})};
  });
  return checkPower(this.solved(),parts);
 }
}
