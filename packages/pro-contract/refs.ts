/**
 * Display refs (plan D2): F1/N2/GW/L3 in the UX, slugs in storage. Pure; never stored, never used as keys.
 * Numbering follows spec order. Wires keep their stored W# id; terminal blocks and glands are numbered by wiring.ts
 * (use terminalRef/glandRef to format).
 */
import type {SystemSpec} from './system-spec.js';

export interface DisplayRefs{
 fields:Record<string,string>;      // fieldId -> 'F1'
 nodes:Record<string,string>;       // nodeId  -> 'N1' | 'GW' (non-gateway nodes numbered from 1 in spec order)
 links:Record<string,string>;       // linkId  -> 'L1'
 /** nodeId -> wireId -> display ref (the stored W# id as is). */
 wires:Record<string,Record<string,string>>;
}
export const terminalRef=(n:number)=>`TB${n}`;
export const glandRef=(n:number)=>`G${n}`;

type RefInput={fields:{id:string}[];nodes:{id:string;role:string;wires?:{id:string}[]}[];links:{id:string}[]};
export function displayRefs(spec:Pick<SystemSpec,'fields'|'nodes'|'links'>|RefInput):DisplayRefs{
 const out:DisplayRefs={fields:{},nodes:{},links:{},wires:{}};
 spec.fields.forEach((f,i)=>{out.fields[f.id]=`F${i+1}`;});
 let n=0;
 spec.nodes.forEach(node=>{
  out.nodes[node.id]=node.role==='gateway'?'GW':`N${++n}`;
  out.wires[node.id]=Object.fromEntries((node.wires??[]).map(w=>[w.id,w.id]));
 });
 spec.links.forEach((l,i)=>{out.links[l.id]=`L${i+1}`;});
 return out;
}
