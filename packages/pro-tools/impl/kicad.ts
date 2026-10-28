/**
 * export_kicad (deterministic): KiCad 9 carrier-board project for one node (.kicad_pro/.kicad_sch/.kicad_pcb + README.txt) as a store-only ZIP.
 * Female-header footprints come from part.footprint (fallback: one row of the catalog pins); placement is a shelf packer; no tracks. Same input -> same bytes.
 */
import {createHash} from 'node:crypto';
import type {SystemSpec} from '../../pro-contract/system-spec.js';
import {mkIssue,pinDefs,type PartLookup,type ToolIssue} from './common.js';

export type ExportKicadInput={projectId:string;revision?:number;nodeId:string};
export type ExportKicadOutput={ok:boolean;files:{name:string;bytes:number;sha256:string}[];zipBase64:string;issues:ToolIssue[]};

type Row={ox:number;oy:number;pitch:number;pins:string[]};
type Mod={ref:string;label:string;w:number;h:number;rows:Row[];holes:{x:number;y:number;d:number}[];x:number;y:number};
const MARGIN=5,GAP=2,COURT=0.25,PITCH=2.54,MAX_ROW_W=110;
/**
 * Dev-board headers for boards that are not catalog parts (published pinouts, not yet measured by staff): ESP32-DevKitC V4 (2x19, rows 25.4 mm apart),
 * Raspberry Pi Pico W (2x20, 17.78 mm), Arduino Nano (2x15, 15.24 mm). Rows run along x; names match the board profile and rails.
 */
type BoardFp={w:number;h:number;rowGap:number;top:string[];bottom:string[]};
const g=(...n:number[])=>n.map(x=>`GPIO${x}`),gp=(...n:number[])=>n.map(x=>`GP${x}`);
const BOARD_FP:Record<string,BoardFp>={
 'esp32-devkitc':{w:54.4,h:27.9,rowGap:25.4,
  top:['3V3','EN',...g(36,39,34,35,32,33,25,26,27,14,12),'GND',...g(13,9,10,11),'5V'],
  bottom:['GND',...g(23,22,1,3,21),'GND',...g(19,18,5,17,16,4,0,2,15,8,7,6)]},
 'pico-w':{w:51,h:21,rowGap:17.78,
  top:[...gp(0,1),'GND',...gp(2,3,4,5),'GND',...gp(6,7,8,9),'GND',...gp(10,11,12,13),'GND',...gp(14,15)],
  bottom:['VBUS','VSYS','GND','3V3_EN','3V3','ADC_VREF','GP28','AGND',...gp(27,26),'RUN',...gp(22),'GND',...gp(21,20,19,18),'GND',...gp(17,16)]},
 'nano':{w:43.2,h:18.5,rowGap:15.24,
  top:['D1','D0','RST','GND','D2','D3','D4','D5','D6','D7','D8','D9','D10','D11','D12'],
  bottom:['VIN','GND','RST','5V','A7','A6','A5','A4','A3','A2','A1','A0','AREF','3V3','D13']},
};
const boardFootprint=(board:string)=>{const b=BOARD_FP[board];if(!b)return undefined;const ox=(b.w-(b.top.length-1)*PITCH)/2,oy=(b.h-b.rowGap)/2;
 return {outlineMm:{w:b.w,h:b.h},rows:[{origin:{x:ox,y:oy},pitch:PITCH,pins:b.top},{origin:{x:ox,y:oy+b.rowGap},pitch:PITCH,pins:b.bottom}],holes:[] as {x:number;y:number;d:number}[]};};
const sha=(b:Uint8Array|string)=>createHash('sha256').update(b).digest('hex');
const uuid=(s:string)=>{const h=createHash('sha1').update(s).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;};
const n=(v:number)=>String(+v.toFixed(4));
const q=(s:string)=>`"${s.replace(/\\/g,'\\\\').replace(/"/g,'\\"')}"`;
const netName=(s:string)=>s.replace(/[^A-Za-z0-9_.+-]/g,'_');

// ---- ZIP (store only) ----
const CRC=(()=>{const t=new Uint32Array(256);for(let i=0;i<256;i++){let c=i;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[i]=c>>>0;}return t;})();
const crc32=(b:Uint8Array)=>{let c=0xffffffff;for(const x of b)c=CRC[(c^x)&255]!^(c>>>8);return (c^0xffffffff)>>>0;};
export function zipStore(files:{name:string;data:Uint8Array}[]):Buffer{
 const parts:Buffer[]=[],cd:Buffer[]=[];let off=0;
 for(const f of files){
  const nm=Buffer.from(f.name),crc=crc32(f.data),h=Buffer.alloc(30);
  h.writeUInt32LE(0x04034b50,0);h.writeUInt16LE(20,4);h.writeUInt16LE(0x0800,6);h.writeUInt16LE(0,8);h.writeUInt16LE(0,10);h.writeUInt16LE(0x21,12);
  h.writeUInt32LE(crc,14);h.writeUInt32LE(f.data.length,18);h.writeUInt32LE(f.data.length,22);h.writeUInt16LE(nm.length,26);
  parts.push(h,nm,Buffer.from(f.data));
  const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50,0);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(0x0800,8);c.writeUInt16LE(0,10);c.writeUInt16LE(0,12);c.writeUInt16LE(0x21,14);
  c.writeUInt32LE(crc,16);c.writeUInt32LE(f.data.length,20);c.writeUInt32LE(f.data.length,24);c.writeUInt16LE(nm.length,28);c.writeUInt32LE(off,42);
  cd.push(c,nm);off+=30+nm.length+f.data.length;
 }
 const cdb=Buffer.concat(cd),e=Buffer.alloc(22);e.writeUInt32LE(0x06054b50,0);e.writeUInt16LE(files.length,8);e.writeUInt16LE(files.length,10);e.writeUInt32LE(cdb.length,12);e.writeUInt32LE(off,16);
 return Buffer.concat([...parts,cdb,e]);
}

export function exportKicad(input:ExportKicadInput,deps:{spec:SystemSpec;lookup:PartLookup}):ExportKicadOutput{
 const issues:ToolIssue[]=[],node=deps.spec.nodes.find(x=>x.id===input.nodeId);
 if(!node){issues.push(mkIssue('kicad.node-unknown','error',`Node ${input.nodeId} is not in the spec.`,`Node ${input.nodeId} tidak ada di spec.`,input.nodeId));return {ok:false,files:[],zipBase64:'',issues};}
 // 1. nets: union-find over wire ends
 const term=(e:{part:string;pin:string})=>`${e.part}.${e.pin}`;
 const parent=new Map<string,string>();const find=(a:string):string=>{if(!parent.has(a))parent.set(a,a);const p=parent.get(a)!;if(p===a)return a;const r=find(p);parent.set(a,r);return r;};
 const wireOf=new Map<string,string>();
 for(const w of node.wires){const a=term(w.from),b=term(w.to);find(a);find(b);const ra=find(a),rb=find(b);if(ra!==rb)parent.set(rb,ra);wireOf.set(a,w.id);wireOf.set(b,w.id);}
 const groups=new Map<string,string[]>();for(const t of [...parent.keys()].sort()){const r=find(t);(groups.get(r)??groups.set(r,[]).get(r)!).push(t);}
 const nets:{name:string;terms:string[]}[]=[];const used=new Set<string>();
 for(const terms of groups.values()){
  const bp=terms.find(t=>t.startsWith('board.'));let name=bp?bp.slice(6):`N_${wireOf.get(terms[0]!)!}`;
  name=netName(name);let k=2;const base=name;while(used.has(name))name=`${base}_${k++}`;used.add(name);
  nets.push({name,terms});
  if(terms.length<2)issues.push(mkIssue('kicad.net-single','warning',`Net ${name} has a single pin.`,`Net ${name} hanya punya satu pin.`,name));
 }
 nets.sort((a,b)=>a.name<b.name?-1:1);
 const netOf=new Map<string,string>();for(const x of nets)for(const t of x.terms)netOf.set(t,x.name);
 const usedPins=(ref:string)=>[...new Set(node.wires.flatMap(w=>[w.from,w.to]).filter(e=>e.part===ref).map(e=>e.pin))];
 // 2. modules
 const mods:Mod[]=[];
 const mk=(ref:string,partId:string,label:string)=>{
  const rec=deps.lookup(partId),fp=rec?.footprint?.v??(ref==='board'?boardFootprint(partId):undefined);
  if(fp){
   const rows=fp.rows.map(r=>({ox:r.origin.x,oy:r.origin.y,pitch:r.pitch,pins:r.pins}));
   const have=new Set(rows.flatMap(r=>r.pins));
   for(const p of usedPins(ref))if(!have.has(p))issues.push(mkIssue('kicad.pin-not-in-footprint','warning',`${ref} pin ${p} is wired but missing in the footprint.`,`${ref} pin ${p} dikabel tapi tidak ada di footprint.`,ref));
   mods.push({ref,label,w:fp.outlineMm.w,h:fp.outlineMm.h,rows,holes:fp.holes,x:0,y:0});return;
  }
  issues.push(mkIssue('kicad.footprint-fallback','warning',`${ref} has no stored footprint; one header row from its pins is used.`,`${ref} belum punya footprint; dipakai satu baris header dari pin-nya.`,ref));
  const names=[...(rec?pinDefs(rec).map(p=>p.name):[]),...usedPins(ref)].filter((v,i,a)=>a.indexOf(v)===i);
  const pins=names.length?names:['1'];
  mods.push({ref,label,w:pins.length*PITCH+2,h:6,rows:[{ox:1+PITCH/2,oy:3,pitch:PITCH,pins}],holes:[],x:0,y:0});
 };
 mk('board',node.board,node.board);
 for(const p of node.parts)mk(p.id,p.kind,p.kind);
 // 3. shelf packer
 let cx=0,cy=0,rowH=0,maxX=0;
 for(const m of mods){
  const w=m.w+2*COURT,h=m.h+2*COURT;
  if(cx>0&&cx+w>MAX_ROW_W){cx=0;cy+=rowH+GAP;rowH=0;}
  m.x=MARGIN+cx+COURT;m.y=MARGIN+cy+COURT;cx+=w+GAP;rowH=Math.max(rowH,h);maxX=Math.max(maxX,cx-GAP);
 }
 const W=maxX+2*MARGIN,H=cy+rowH+2*MARGIN;
 for(const a of mods){
  if(a.x-COURT<0||a.y-COURT<0||a.x+a.w+COURT>W||a.y+a.h+COURT>H)issues.push(mkIssue('kicad.off-board','error',`${a.ref} is outside the board outline.`,`${a.ref} di luar outline board.`,a.ref));
  for(const b of mods)if(a.ref<b.ref&&a.x-COURT<b.x+b.w+COURT&&b.x-COURT<a.x+a.w+COURT&&a.y-COURT<b.y+b.h+COURT&&b.y-COURT<a.y+a.h+COURT)issues.push(mkIssue('kicad.overlap','error',`${a.ref} overlaps ${b.ref}.`,`${a.ref} bertumpuk dengan ${b.ref}.`,a.ref));
 }
 // 4. files
 const pcbHead=`(kicad_pcb (version 20241229) (generator "aiot-export") (generator_version "9.0")\n (general (thickness 1.6) (legacy_teardrops no))\n (paper "A4")\n (layers (0 "F.Cu" signal) (2 "B.Cu" signal) (5 "F.SilkS" user "F.Silkscreen") (7 "B.SilkS" user "B.Silkscreen") (1 "F.Mask" user) (3 "B.Mask" user) (25 "Edge.Cuts" user) (31 "F.CrtYd" user "F.Courtyard") (35 "F.Fab" user "F.Fabrication"))\n (setup (pad_to_mask_clearance 0))\n (net 0 "")\n`;
 const netIdx=new Map(nets.map((x,i)=>[x.name,i+1]));
 let pcb=pcbHead+nets.map((x,i)=>` (net ${i+1} ${q(x.name)})\n`).join('');
 pcb+=` (gr_rect (start 0 0) (end ${n(W)} ${n(H)}) (stroke (width 0.1) (type default)) (fill no) (layer "Edge.Cuts") (uuid "${uuid(`${input.nodeId}/edge`)}"))\n`;
 const padName=(m:Mod)=>{const names:{pin:string;x:number;y:number}[]=[];for(const r of m.rows)r.pins.forEach((p,i)=>names.push({pin:p,x:r.ox+i*r.pitch,y:r.oy}));return names;};
 for(const m of mods){
  pcb+=` (footprint ${q(`AIoT:${netName(m.label)}_Socket`)} (layer "F.Cu") (uuid "${uuid(`${input.nodeId}/fp/${m.ref}`)}") (at ${n(m.x)} ${n(m.y)})\n`;
  pcb+=`  (property "Reference" ${q(m.ref)} (at 0 -1.5 0) (layer "F.SilkS") (uuid "${uuid(`${input.nodeId}/ref/${m.ref}`)}") (effects (font (size 1 1) (thickness 0.15))))\n`;
  pcb+=`  (property "Value" ${q(m.label)} (at 0 ${n(m.h+1.5)} 0) (layer "F.Fab") (uuid "${uuid(`${input.nodeId}/val/${m.ref}`)}") (effects (font (size 1 1) (thickness 0.15))))\n`;
  pcb+=`  (fp_rect (start 0 0) (end ${n(m.w)} ${n(m.h)}) (stroke (width 0.12) (type default)) (fill no) (layer "F.SilkS") (uuid "${uuid(`${input.nodeId}/sil/${m.ref}`)}"))\n`;
  pcb+=`  (fp_rect (start ${n(-COURT)} ${n(-COURT)}) (end ${n(m.w+COURT)} ${n(m.h+COURT)}) (stroke (width 0.05) (type default)) (fill no) (layer "F.CrtYd") (uuid "${uuid(`${input.nodeId}/crt/${m.ref}`)}"))\n`;
  padName(m).forEach((p,i)=>{const nn=netOf.get(`${m.ref}.${p.pin}`);
   pcb+=`  (pad "${i+1}" thru_hole ${i===0?'rect':'circle'} (at ${n(p.x)} ${n(p.y)}) (size 1.7 1.7) (drill 1) (layers "*.Cu" "*.Mask")${nn?` (net ${netIdx.get(nn)} ${q(nn)})`:''} (pinfunction ${q(p.pin)}) (uuid "${uuid(`${input.nodeId}/pad/${m.ref}/${i}`)}"))\n`;});
  m.holes.forEach((h,i)=>{pcb+=`  (pad "" np_thru_hole circle (at ${n(h.x)} ${n(h.y)}) (size ${n(h.d)} ${n(h.d)}) (drill ${n(h.d)}) (layers "*.Cu" "*.Mask") (uuid "${uuid(`${input.nodeId}/hole/${m.ref}/${i}`)}"))\n`;});
  pcb+=` )\n`;
 }
 pcb+=')\n';
 // schematic
 let sch=`(kicad_sch (version 20250114) (generator "aiot-export") (generator_version "9.0")\n (uuid "${uuid(`${input.nodeId}/sch`)}")\n (paper "A3")\n (lib_symbols\n`;
 const symPlace:string[]=[];let sx=30,sy=30,colH=0;
 for(const m of mods){
  const pins=padName(m).map(p=>p.pin),lib=`Conn_01x${String(pins.length).padStart(2,'0')}_Socket_${netName(m.ref)}`,hh=pins.length*PITCH+PITCH;
  sch+=`  (symbol ${q(`AIoT:${lib}`)} (pin_names (offset 1.016)) (exclude_from_sim no) (in_bom yes) (on_board yes)\n`;
  sch+=`   (property "Reference" "J" (at 0 ${n(PITCH)} 0) (effects (font (size 1.27 1.27))))\n   (property "Value" ${q(m.label)} (at 0 ${n(-hh)} 0) (effects (font (size 1.27 1.27))))\n`;
  sch+=`   (symbol ${q(`${lib}_1_1`)}\n    (rectangle (start -1.27 ${n(PITCH/2)}) (end 5.08 ${n(-(pins.length-0.5)*PITCH)}) (stroke (width 0.254) (type default)) (fill (type background)))\n`;
  pins.forEach((p,i)=>{sch+=`    (pin passive line (at -3.81 ${n(-i*PITCH)} 0) (length 2.54) (name ${q(p)} (effects (font (size 1.27 1.27)))) (number "${i+1}" (effects (font (size 1.27 1.27)))))\n`;});
  sch+=`   ))\n`;
  if(sy+hh>400){sx+=70;sy=30;}
  symPlace.push(`(symbol (lib_id ${q(`AIoT:${lib}`)}) (at ${n(sx)} ${n(sy)} 0) (unit 1) (exclude_from_sim no) (in_bom yes) (on_board yes) (dnp no) (uuid "${uuid(`${input.nodeId}/sym/${m.ref}`)}")\n  (property "Reference" ${q(m.ref)} (at ${n(sx)} ${n(sy-PITCH*1.5)} 0) (effects (font (size 1.27 1.27))))\n  (property "Value" ${q(m.label)} (at ${n(sx)} ${n(sy+hh)} 0) (effects (font (size 1.27 1.27))))\n  (property "Footprint" ${q(`AIoT:${netName(m.label)}_Socket`)} (at ${n(sx)} ${n(sy)} 0) (effects (font (size 1.27 1.27)) hide))\n`
   +pins.map((_,i)=>`  (pin "${i+1}" (uuid "${uuid(`${input.nodeId}/sympin/${m.ref}/${i}`)}"))\n`).join('')
   +`  (instances (project "${netName(input.nodeId)}" (path "/${uuid(`${input.nodeId}/sch`)}" (reference ${q(m.ref)}) (unit 1))))\n )`);
  pins.forEach((p,i)=>{const nn=netOf.get(`${m.ref}.${p}`);if(nn)symPlace.push(`(global_label ${q(nn)} (shape passive) (at ${n(sx-3.81)} ${n(sy+i*PITCH)} 180) (effects (font (size 1.27 1.27)) (justify right)) (uuid "${uuid(`${input.nodeId}/lbl/${m.ref}/${i}`)}") (property "Intersheetrefs" "" (at 0 0 0) (effects (font (size 1.27 1.27)) hide)))`);});
  sy+=hh+10;colH=Math.max(colH,sy);
 }
 sch+=` )\n ${symPlace.join('\n ')}\n (sheet_instances (path "/" (page "1")))\n)\n`;
 const pro=JSON.stringify({meta:{filename:`${netName(input.nodeId)}.kicad_pro`,version:3},board:{design_settings:{rules:{min_clearance:0.2}}},sheets:[[uuid(`${input.nodeId}/sch`),'Root']],text_variables:{}},null,2)+'\n';
 const readme=`AIoT carrier board for node ${input.nodeId} (project ${input.projectId}${input.revision!==undefined?`, revision ${input.revision}`:''}).\nGenerated by AIoT export_kicad. KiCad 9 format. Female headers: modules plug in. No tracks: route the board yourself.\nGeometry comes from the AIoT part catalog (staff-verified, confidence medium until measured); check every footprint against the real module before ordering.\nStock KiCad footprints, if you add them, are CC-BY-SA-4.0 WITH KiCad-libraries-exception. No vendor, datasheet or distributor data is included.\n`;
 const base=netName(input.nodeId);
 const list=[{name:`${base}.kicad_pro`,data:pro},{name:`${base}.kicad_sch`,data:sch},{name:`${base}.kicad_pcb`,data:pcb},{name:'README.txt',data:readme}].map(f=>({name:f.name,data:Buffer.from(f.data)}));
 const zip=zipStore(list);
 return {ok:!issues.some(i=>i.severity==='error'),files:list.map(f=>({name:f.name,bytes:f.data.length,sha256:sha(f.data)})),zipBase64:zip.toString('base64'),issues};
}
