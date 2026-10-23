/**
 * Pure plan of one node assembly (no three.js, no DOM). Units: millimetres.
 * Frame: x right, y up, z toward the viewer. The enclosure back plate is the z=0 plane, centred on x=y=0.
 * Parts that live in the enclosure lie on the plate; field, pole and pipe parts hang outside below it.
 * Item numbers (balloons) are the tree order: board 1, parts 2..n, enclosure last.
 */
import type {ProNode} from '../../../../../packages/pro-contract/system-spec';

export type Vec3=[number,number,number];
export interface PartSize{
 /** Box on the plate: x, y across the plate, z thickness off it. */
 size:Vec3;
 /** True when a registered 3D model draws the part; false means a labelled box. */
 has3d:boolean;
 /** Registered lab kind that draws it (3D parts only). */
 labKind?:string;
}
export type SizeOf=(kind:string)=>PartSize;
export type ItemType='board'|'part'|'enclosure';
export interface AssemblyItem{
 /** Selection id: node-local part id, 'board' or 'enclosure'. */
 id:string;
 ref:number;
 type:ItemType;
 kind:string;
 label:string;
 has3d:boolean;
 labKind?:string;
 /** Centre of the box in the assembled state. */
 pos:Vec3;
 size:Vec3;
 /** Unit direction the part moves along when exploded. */
 dir:Vec3;
 /** Distance in mm at 100 % explode. */
 travel:number;
 inside:boolean;
 /** The plate has no room for this part: it is drawn beside the enclosure (a layout warning, not an error). */
 overflow?:boolean;
}
export interface AssemblyPlan{
 nodeId:string;
 items:AssemblyItem[];
 enclosure:{w:number;h:number;d:number};
 boxCount:number;
}

const BOARD_KIND:Record<string,string>={'esp32-devkitc':'esp32-devkit','esp32-s3-devkitc':'esp32-s3-devkitc','rpi-4b':'rpi-4b','rpi-5':'rpi-5','pico-w':'rpi-pico','uno':'arduino-uno','nano':'arduino-nano'};
const GAP=6,MARGIN=8,PLATE_Z=3;
const BOARD_BOX:Record<string,Vec3>={'esp32-devkitc':[55,28,12],'esp32-s3-devkitc':[70,26,12],'rpi-4b':[85,56,18],'rpi-5':[85,56,18],'pico-w':[51,21,8],uno:[69,53,15],nano:[45,18,10]};

/** Default box (datasheet class) for kinds with no 3D model. Ends up under the part label, never drawn as a real model. */
const BOX_BY_KIND:Record<string,Vec3>={
 'lora-rfm95w':[16,16,3],'battery-18650-pack':[77,21,21],'soil-moisture-capacitive':[98,23,4],'solenoid-valve-12v':[60,40,50],
 'solar-charge-pwm':[60,45,18],'solar-panel':[200,150,15],'pump-12v-r385':[60,30,30],'max485':[20,18,6],'bh1750':[19,15,3],
};
const BOX_BY_ROLE:Record<string,Vec3>={sensor:[30,20,8],actuator:[50,30,25],radio:[18,18,5],power:[50,30,18],display:[40,25,8],interface:[25,18,6],protection:[20,14,8]};

export const boxSizeOf=(kind:string,role='sensor'):Vec3=>BOX_BY_KIND[kind]??BOX_BY_ROLE[role]??[30,20,8];
export const boardKindOf=(board:string):string=>BOARD_KIND[board]??board;
export const boardBoxOf=(board:string):Vec3=>BOARD_BOX[board]??[60,30,12];

/** Titles shown in labels and balloons: kind slug made readable, e.g. 'lora-rfm95w' -> 'LoRa RFM95W'. */
const TITLES:Record<string,string>={'esp32-devkitc':'ESP32-DevKitC','esp32-s3-devkitc':'ESP32-S3-DevKitC','rpi-4b':'Raspberry Pi 4B','rpi-5':'Raspberry Pi 5','pico-w':'Pico W','uno':'Arduino Uno','nano':'Arduino Nano','ds18b20':'DS18B20 probe','battery-18650-pack':'18650 battery pack','lora-rfm95w':'LoRa RFM95W'};
export function kindTitle(kind:string):string{
 if(TITLES[kind])return TITLES[kind]!;
 return kind.split('-').map(w=>w==='lora'?'LoRa':/^(rfm|rs|esp|bh|ds|max|pwm|ip|ph)/i.test(w)||/\d/.test(w)?w.toUpperCase():w[0]!.toUpperCase()+w.slice(1)).join(' ');
}

export function planAssembly(node:ProNode,sizeOf:SizeOf):AssemblyPlan{
 const enc=node.enclosure.sizeMm;
 const items:AssemblyItem[]=[];
 const inside:{id:string;type:ItemType;kind:string;label:string;sz:PartSize}[]=[];
 const outside:typeof inside=[];
 const bKind=boardKindOf(node.board);
 const bSz=(()=>{const s=sizeOf(bKind);return s.has3d?s:{size:boardBoxOf(node.board),has3d:false};})();
 inside.push({id:'board',type:'board',kind:node.board,label:kindTitle(node.board),sz:bSz});
 for(const p of node.parts){
  const sz=sizeOf(p.kind);
  const entry={id:p.id,type:'part' as const,kind:p.kind,label:kindTitle(p.kind),sz:sz.has3d?sz:{...sz,size:boxSizeOf(p.kind,p.role)}};
  (p.mount==='enclosure'?inside:outside).push(entry);
 }
 // shelf packing on the plate, left to right, top to bottom; what does not fit is laid beside the enclosure (flagged overflow)
 const usableW=Math.max(20,enc.w-2*MARGIN),usableH=Math.max(20,enc.h-2*MARGIN);
 let x=0,y=0,rowH=0,ovY=0;
 const overflow=new Set<string>();
 const slots:{e:typeof inside[number];x:number;y:number}[]=[];
 for(const e of inside){
  const [w,h]=e.sz.size;
  if(x>0&&x+w>usableW){x=0;y+=rowH+GAP;rowH=0;}
  if(y+h>usableH&&slots.length){overflow.add(e.id);continue;}
  slots.push({e,x,y});
  x+=w+GAP;rowH=Math.max(rowH,h);
 }
 const ovList=inside.filter(e=>overflow.has(e.id));
 for(const p of slots){
  const [w,h,d]=p.e.sz.size;
  const pos:Vec3=[-enc.w/2+MARGIN+p.x+w/2,enc.h/2-MARGIN-p.y-h/2,PLATE_Z+d/2];
  const dir=norm([pos[0]/(enc.w/2||1)*0.35,pos[1]/(enc.h/2||1)*0.35,1]);
  items.push({id:p.e.id,ref:0,type:p.e.type,kind:p.e.kind,label:p.e.label,has3d:p.e.sz.has3d,labKind:p.e.sz.labKind,pos,size:[w,h,d],dir,travel:60,inside:true});
 }
 for(const e of ovList){
  const [w,h,d]=e.sz.size;
  items.push({id:e.id,ref:0,type:e.type,kind:e.kind,label:e.label,has3d:e.sz.has3d,labKind:e.sz.labKind,pos:[enc.w/2+30+w/2,enc.h/2-h/2-ovY,d/2],size:[w,h,d],dir:[1,0,0],travel:40,inside:false,overflow:true});
  ovY+=h+GAP;
 }
 // outside parts: a row below the enclosure, moving down when exploded
 const rowW=outside.reduce((s,e)=>s+e.sz.size[0]+GAP,-GAP);
 let ox=-rowW/2;
 for(const e of outside){
  const [w,h,d]=e.sz.size;
  items.push({id:e.id,ref:0,type:e.type,kind:e.kind,label:e.label,has3d:e.sz.has3d,labKind:e.sz.labKind,pos:[ox+w/2,-enc.h/2-40-h/2,d/2],size:[w,h,d],dir:[0,-1,0],travel:50,inside:false});
  ox+=w+GAP;
 }
 items.push({id:'enclosure',ref:0,type:'enclosure',kind:'enclosure-ip65',label:`Enclosure ${node.enclosure.ip} ${enc.w}x${enc.h}x${enc.d}`,has3d:false,pos:[0,0,enc.d/2],size:[enc.w,enc.h,enc.d],dir:[0,0,1],travel:0,inside:false});
 const order=new Map<string,number>(['board',...node.parts.map(p=>p.id),'enclosure'].map((id,i)=>[id,i+1]));
 for(const it of items)it.ref=order.get(it.id)!;
 items.sort((a,b)=>a.ref-b.ref);
 return {nodeId:node.id,items,enclosure:{w:enc.w,h:enc.h,d:enc.d},boxCount:items.filter(i=>i.type!=='enclosure'&&!i.has3d).length};
}

function norm(v:Vec3):Vec3{const l=Math.hypot(...v)||1;return [v[0]/l,v[1]/l,v[2]/l];}

/** Axis-aligned bounds of the plan, optionally exploded (k 0..1). */
export function planBounds(plan:AssemblyPlan,k=0):{min:Vec3;max:Vec3}{
 const min:Vec3=[Infinity,Infinity,Infinity],max:Vec3=[-Infinity,-Infinity,-Infinity];
 for(const it of plan.items){
  const o=explodedPos(it,k);
  for(let a=0;a<3;a++){min[a]=Math.min(min[a]!,o[a]!-it.size[a]!/2);max[a]=Math.max(max[a]!,o[a]!+it.size[a]!/2);}
 }
 return {min,max};
}
/** Position of an item at explode fraction k (0 assembled, 1 fully exploded). */
export function explodedPos(it:AssemblyItem,k:number):Vec3{
 const c=Math.min(1,Math.max(0,k))*it.travel;
 return [it.pos[0]+it.dir[0]*c,it.pos[1]+it.dir[1]*c,it.pos[2]+it.dir[2]*c];
}
