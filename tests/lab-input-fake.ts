/** Fake board for the input-module part tests: a cycle clock with scheduled callbacks, pin levels, output modes and an edge log. Own helper of the input-modules group. */
import type {BoardPin,Circuit,UnoPin} from '../apps/web/src/lab/contract.js';
import {EMPTY,createModels} from '../apps/web/src/lab/sim/peripherals.js';

export function fakeBoard(){
 const events:{at:number;cb:()=>void}[]=[];
 let now=0;
 const log:{pin:UnoPin;level:boolean;at:number}[]=[],adc:{ch:number;volts:number}[]=[];
 const level:Partial<Record<UnoPin,boolean>>={},mode:Partial<Record<UnoPin,'output'|'input'|'input-pullup'>>={},out:Partial<Record<UnoPin,0|1>>={};
 const pinLevel=(p:UnoPin):0|1=>mode[p]==='output'?(out[p]??0):(level[p]===false?0:1);
 return {log,adc,level,mode,out,pinLevel,
  env:{
   setPin:(p:UnoPin,l:boolean)=>{log.push({pin:p,level:l,at:now});level[p]=l;},
   setAdc:(ch:number,v:number)=>{adc.push({ch,volts:v});},
   schedule:(c:number,cb:()=>void)=>{events.push({at:now+c,cb});events.sort((a,b)=>a.at-b.at);},
   now:()=>now,
   pinMode:(p:UnoPin)=>mode[p]??'input',
   pinLevel:(p:UnoPin)=>pinLevel(p),
   watchLine:()=>undefined,
  } as never,
  at:(n:number)=>{now=n;},
  run(to:number){while(events.length&&events[0]!.at<=to){const e=events.shift()!;now=e.at;e.cb();}now=to;},
  /** Edges of one pin as [cycle, level] pairs. */
  edges:(p:UnoPin)=>log.filter(x=>x.pin===p).map(x=>[x.at,x.level?1:0] as [number,number]),
 };
}
export type Board=ReturnType<typeof fakeBoard>;
export const circuitOf=(kind:string,net:Partial<Record<string,BoardPin>>,props:Record<string,string|number|boolean>={}):Circuit=>({wires:[],parts:[{id:kind+'1',kind,net,props}]});
export const modelOf=(b:Board,kind:string,net:Partial<Record<string,BoardPin>>,props:Record<string,string|number|boolean>={})=>createModels(circuitOf(kind,net,props),b.env).get(kind+'1')!;
export const frame=(cycles:number)=>({dtSec:0,cycles,samples:EMPTY()});
