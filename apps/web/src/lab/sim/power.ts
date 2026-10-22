/**
 * Simple power-net solver (DC, no currents except as a rating check). Pure: no DOM, no three.js; used by the live simulator (sim/world.ts)
 * and by the CircuitSpec validator, so the AI builder and the lab warn about the same mistakes.
 *
 * Model: nodes are `B:<boardPin>` (D13, A0, 5V, 3V3, GND, VIN) and `P:<part>.<pin>`. Wires and shared breadboard strips make nets
 * (groups of nodes). A closed contact (relay COM-NO) merges two nets. Every net gets one voltage, or null when nothing drives it:
 *   - board rails are ideal sources: GND 0 V, 5V 5 V, 3V3 3.3 V (a board pin set as output is a weak source of 0 V or 5 V);
 *   - a supply declares pos/neg/volts (battery, breadboard power module): V(pos)=V(neg)+volts, and V(neg)=0 when nothing else fixes it;
 *   - a regulator gives min(volts, in-dropout) above its gnd pin;
 *   - a part may drive a pin (L298N OUT1) with a voltage and a source impedance; the lowest impedance on a net wins.
 * Then each part with a PowerSpec is checked: rail voltage inside min..max, and `external` parts not fed from a board pin.
 */
import type {PartProps} from '../contract';
import type {PinDrive,PowerSpec,RegulatorDecl,SupplyDecl,SwitchDecl} from './devices/types';

export type Origin='ground'|'board-rail'|'board-io'|'supply'|'regulator'|'driver';
export interface PowerPartInfo{
 id:string;kind:string;props:PartProps;
 supplies:readonly SupplyDecl[];regulators:readonly RegulatorDecl[];
 /** pin -> what the part drives right now (runtime only) */
 drives:readonly {pin:string;drive:PinDrive}[];
 switches:readonly SwitchDecl[];
}
export interface PowerInput{
 /** nets as groups of node names */
 groups:readonly (readonly string[])[];
 parts:readonly PowerPartInfo[];
 /** a board digital/analog pin the MCU drives as output: its voltage (null: not driven). Static checks pass nothing. */
 io?:(pin:string)=>number|null;
 /** voltage of the VIN pin when nothing powers it (USB only): about 4.7 V through the input diode */
 vinIdle?:number;
}
export const BOARD_RAILS:Readonly<Record<string,number>>={GND:0,'5V':5,'3V3':3.3};
/** What a board pin can give, in mA (ATmega328P I/O 20 mA continuous, the 3V3 regulator 150 mA, 5V from USB 500 mA). */
export const BOARD_LIMIT_MA:Readonly<Record<string,number>>={'5V':500,'3V3':150,VIN:1000,IO:20};

interface Src{volts:number;ohms:number;origin:Origin}
const IDEAL=0;

export class PowerNetwork{
 private parent=new Map<string,string>();
 private volt=new Map<string,number>();
 private origin=new Map<string,Origin>();
 /** two ideal sources of different voltage on one net */
 conflicts:{node:string;a:number;b:number}[]=[];
 /** regulators whose input is too low to hold their output */
 dropouts:{part:string;volts:number;need:number}[]=[];
 constructor(private input:PowerInput){this.solve();}

 private find(a:string):string{
  let r=a;
  while(true){const p=this.parent.get(r);if(p===undefined){this.parent.set(r,r);return r;}if(p===r)break;r=p;}
  let c=a;
  while(c!==r){const n=this.parent.get(c)!;this.parent.set(c,r);c=n;}
  return r;
 }
 private union(a:string,b:string):void{const ra=this.find(a),rb=this.find(b);if(ra!==rb)this.parent.set(ra,rb);}

 /** Voltage of a node's net, or null when nothing drives it. */
 volts(node:string):number|null{const v=this.volt.get(this.find(node));return v===undefined?null:v;}
 /** Where the net's voltage comes from. */
 originOf(node:string):Origin|null{return this.origin.get(this.find(node))??null;}
 /** Nodes on the same net, itself excluded. */
 peers(node:string):string[]{
  const r=this.find(node);
  const out:string[]=[];
  for(const k of [...this.parent.keys()])if(k!==node&&this.find(k)===r)out.push(k);
  return out;
 }

 private solve():void{
  const {groups,parts}=this.input;
  for(const g of groups){for(let i=0;i<g.length;i++)this.find(g[i]!);for(let i=1;i<g.length;i++)this.union(g[0]!,g[i]!);}
  for(const p of parts)for(const s of p.switches)if(s.closed)this.union(`P:${p.id}.${s.a}`,`P:${p.id}.${s.b}`);
  const srcs=new Map<string,Src[]>();
  const add=(node:string,s:Src):void=>{const r=this.find(node);const l=srcs.get(r);if(l)l.push(s);else srcs.set(r,[s]);};
  // board rails and driven pins
  for(const [pin,v] of Object.entries(BOARD_RAILS))if(this.parent.has('B:'+pin))add('B:'+pin,{volts:v,ohms:IDEAL,origin:pin==='GND'?'ground':'board-rail'});
  if(this.input.io)for(const k of [...this.parent.keys()]){
   if(!k.startsWith('B:'))continue;
   const pin=k.slice(2);if(pin in BOARD_RAILS||pin==='VIN')continue;
   const v=this.input.io(pin);if(v!==null)add(k,{volts:v,ohms:25,origin:'board-io'});
  }
  for(const p of parts)for(const d of p.drives)add(`P:${p.id}.${d.pin}`,{volts:d.drive.volts,ohms:d.drive.ohms??0,origin:'driver'});
  // pick the strongest source of each net
  const pick=(r:string):void=>{
   const l=srcs.get(r);if(!l||!l.length)return;
   const best=l.reduce((a,b)=>(b.ohms<a.ohms?b:a));
   this.volt.set(r,best.volts);this.origin.set(r,best.origin);
   const ideal=l.filter(x=>x.ohms===IDEAL);
   if(ideal.length>1&&Math.abs(ideal[0]!.volts-ideal[1]!.volts)>0.3)this.conflicts.push({node:r,a:ideal[0]!.volts,b:ideal[1]!.volts});
  };
  for(const r of srcs.keys())pick(r);
  // supplies and regulators relax until nothing changes
  const set=(node:string,v:number,o:Origin):boolean=>{const r=this.find(node);if(this.volt.has(r))return false;this.volt.set(r,v);this.origin.set(r,o);return true;};
  const relax=():boolean=>{
   let changed=false;
   for(const p of parts){
    for(const s of p.supplies){
     const np=`P:${p.id}.${s.pos}`,nn=`P:${p.id}.${s.neg}`;
     const vn=this.volts(nn),vp=this.volts(np);
     if(vn!==null&&vp===null)changed=set(np,vn+s.volts,'supply')||changed;
     else if(vp!==null&&vn===null)changed=set(nn,vp-s.volts,'supply')||changed;
     // both ends already fixed by something else (a battery wired between 5V and GND, a second source on its terminal): they disagree
     else if(vp!==null&&vn!==null&&Math.abs(vp-vn-s.volts)>0.3&&!this.conflicts.some(c=>c.node===np))this.conflicts.push({node:np,a:vp-vn,b:s.volts});
    }
    for(const g of p.regulators){
     const vi=this.volts(`P:${p.id}.${g.in}`),vg=this.volts(`P:${p.id}.${g.gnd}`);
     if(vi===null||vg===null)continue;
     const out=Math.max(0,Math.min(g.volts,vi-vg-g.dropout))+vg;
     if(vi-vg<g.volts+g.dropout-0.01&&!this.dropouts.some(d=>d.part===p.id))this.dropouts.push({part:p.id,volts:vi-vg,need:g.volts+g.dropout});
     changed=set(`P:${p.id}.${g.out}`,out,'regulator')||changed;
    }
   }
   return changed;
  };
  // a supply nothing else references floats: its minus terminal is its own 0 V reference (chains such as battery -> regulator -> part settle after it)
  const anchorFloating=():boolean=>{
   for(const p of parts)for(const s of p.supplies){
    const np=`P:${p.id}.${s.pos}`,nn=`P:${p.id}.${s.neg}`;
    if(this.volts(np)===null&&this.volts(nn)===null){set(nn,0,'supply');set(np,s.volts,'supply');return true;}
   }
   return false;
  };
  for(let guard=0;guard<64;guard++){
   let n=0;while(relax()&&n++<16);
   if(!anchorFloating())break;
  }
  // the VIN pin sits near 4.7 V when only USB powers the board
  if(this.parent.has('B:VIN')&&this.volts('B:VIN')===null&&this.input.vinIdle!==undefined)set('B:VIN',this.input.vinIdle,'board-rail');
 }
}

// ---------- checking parts against their supply ----------
export type PowerCode='over'|'under'|'external'|'conflict'|'dropout';
export interface PowerNote{
 part:string;kind:string;code:PowerCode;severity:'warning'|'error';
 /** volts across the part's rail (or the offending net) */
 volts:number;
 en:string;id:string;
}
export interface PowerCheckPart{id:string;kind:string;label:{en:string;id:string};power?:PowerSpec}
const v1=(v:number):string=>(Math.round(v*10)/10).toString();

/** Friendly warnings for every part whose supply is wrong, plus supply-level problems (two sources on one net, a regulator without headroom). */
export function checkPower(net:PowerNetwork,parts:readonly PowerCheckPart[]):PowerNote[]{
 const notes:PowerNote[]=[];
 for(const p of parts){
  const spec=p.power;if(!spec)continue;
  const pos=`P:${p.id}.${spec.rail[0]}`,neg=`P:${p.id}.${spec.rail[1]}`;
  const vp=net.volts(pos),vn=net.volts(neg);
  if(vp===null||vn===null)continue;
  const v=vp-vn;
  const name=p.label;
  if(v>spec.max+0.05)notes.push({part:p.id,kind:p.kind,code:'over',severity:'error',volts:v,
   en:`${name.en} is rated ${v1(spec.min)}-${v1(spec.max)} V but its supply pin is at ${v1(v)} V. That can destroy it. Power it from a lower rail (for example the 3V3 pin).`,
   id:`${name.id} dirancang untuk ${v1(spec.min)}-${v1(spec.max)} V tetapi pin catunya ${v1(v)} V. Itu bisa merusaknya. Beri daya dari jalur yang lebih rendah (misalnya pin 3V3).`});
  else if(v<spec.min-0.05&&v>0.3)notes.push({part:p.id,kind:p.kind,code:'under',severity:'warning',volts:v,
   en:`${name.en} needs at least ${v1(spec.min)} V but gets ${v1(v)} V. It may reset, misread or stay dark. Use a higher supply.`,
   id:`${name.id} butuh minimal ${v1(spec.min)} V tetapi hanya mendapat ${v1(v)} V. Bisa reset, salah baca, atau mati. Pakai catu yang lebih tinggi.`});
  if(spec.external){
   const o=net.originOf(pos);
   if(o==='board-rail'||o==='board-io')notes.push({part:p.id,kind:p.kind,code:'external',severity:'warning',volts:v,
    en:`${name.en} can pull ${spec.ma??200} mA or more, which is too much for a board pin${o==='board-io'?' (an I/O pin gives 20 mA)':''}. Give it its own supply (a battery or a driver board) and join the grounds.`,
    id:`${name.id} bisa menarik ${spec.ma??200} mA atau lebih, terlalu besar untuk pin papan${o==='board-io'?' (pin I/O hanya 20 mA)':''}. Beri catu sendiri (baterai atau papan driver) dan sambungkan ground-nya.`});
  }
 }
 for(const c of net.conflicts)notes.push({part:'',kind:'',code:'conflict',severity:'error',volts:Math.max(c.a,c.b),
  en:`Two sources of different voltage (${v1(c.a)} V and ${v1(c.b)} V) are joined on one net. That is a short circuit between supplies. Check the wires on that net.`,
  id:`Dua sumber dengan tegangan berbeda (${v1(c.a)} V dan ${v1(c.b)} V) bertemu di satu jalur. Itu korsleting antar catu. Periksa kabel di jalur tersebut.`});
 for(const d of net.dropouts){
  const p=parts.find(x=>x.id===d.part);
  notes.push({part:d.part,kind:p?.kind??'',code:'dropout',severity:'warning',volts:d.volts,
   en:`${p?.label.en??'The regulator'} gets only ${v1(d.volts)} V in and needs ${v1(d.need)} V to hold its output. The output will sag. Feed it a higher voltage.`,
   id:`${p?.label.id??'Regulator'} hanya mendapat ${v1(d.volts)} V dan butuh ${v1(d.need)} V untuk menahan keluarannya. Keluaran akan turun. Beri tegangan masukan lebih tinggi.`});
 }
 return notes;
}
