/** M5-B: pure CAD logic (plan, explode, isolate, measure, section, view cube, balloons) and the three.js node assembly on the farm fixture. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const ctx2d=new Proxy({},{get:(_t,k)=>k==='canvas'?{}:k==='measureText'?()=>({width:10}):()=>ctx2d,set:()=>true});
const g=globalThis as unknown as {document?:unknown};
g.document??={createElement:()=>({width:0,height:0,getContext:()=>ctx2d,style:{}})};

const {planAssembly,explodedPos,planBounds,kindTitle}=await import('../apps/web/src/pro/cad/plan.js');
const {explodeAll,fractionOf}=await import('../apps/web/src/pro/cad/explode.js');
const {isVisible,isolate,toggleHidden,escape,showAll}=await import('../apps/web/src/pro/cad/isolate.js');
const {measure,formatMm,snapToScreen}=await import('../apps/web/src/pro/cad/measure.js');
const {plane,cuts,initialSection}=await import('../apps/web/src/pro/cad/section.js');
const {combine,FACE_DIR,nearestFace,upFor}=await import('../apps/web/src/pro/cad/view-cube.js');
const {layoutBalloons}=await import('../apps/web/src/pro/cad/balloons.js');
const {createNodeAssembly,modelSizeOf}=await import('../apps/web/src/pro/cad/node-assembly.js');
import type {SystemSpec} from '../packages/pro-contract/system-spec.js';

const spec=JSON.parse(readFileSync(new URL('../packages/pro-contract/fixtures/farm-4-fields/spec.r1.json',import.meta.url),'utf8')) as SystemSpec;
const node=spec.nodes.find(n=>n.id==='node-mango')!;
const plan=planAssembly(node,modelSizeOf);

test('plan: numbering is board, parts in order, enclosure last',()=>{
 assert.equal(plan.items.length,node.parts.length+2);
 assert.deepEqual(plan.items.map(i=>i.ref),plan.items.map((_,i)=>i+1));
 assert.equal(plan.items[0]!.id,'board');
 assert.equal(plan.items.at(-1)!.id,'enclosure');
 assert.deepEqual(plan.items.slice(1,-1).map(i=>i.id),node.parts.map(p=>p.id));
});
test('plan: parts without a model are boxes and counted, 3D ones use the registry',()=>{
 const by=Object.fromEntries(plan.items.map(i=>[i.id,i]));
 assert.equal(by['board']!.has3d,true);
 assert.equal(by['ds18b20-1']!.has3d,true);
 assert.equal(by['soil-moisture-capacitive-1']!.has3d,false);
 assert.equal(plan.boxCount,plan.items.filter(i=>i.type!=='enclosure'&&!i.has3d).length);
 assert.ok(plan.boxCount>=1);
});
test('plan: enclosed parts sit inside the enclosure and do not overlap on one tier',()=>{
 const {w,h}=plan.enclosure;
 const ins=plan.items.filter(i=>i.inside&&!i.overflow);
 for(const i of ins){
  assert.ok(Math.abs(i.pos[0])+i.size[0]/2<=w/2+0.01,`${i.id} x`);
  assert.ok(Math.abs(i.pos[1])+i.size[1]/2<=h/2+0.01,`${i.id} y`);
 }
 for(let a=0;a<ins.length;a++)for(let b=a+1;b<ins.length;b++){
  const p=ins[a]!,q=ins[b]!;
  const ox=Math.abs(p.pos[0]-q.pos[0])<(p.size[0]+q.size[0])/2,oy=Math.abs(p.pos[1]-q.pos[1])<(p.size[1]+q.size[1])/2;
  assert.ok(!(ox&&oy),`${p.id} overlaps ${q.id}`);
 }
});
test('plan: field parts hang outside below the enclosure',()=>{
 const soil=plan.items.find(i=>i.id==='soil-moisture-capacitive-1')!;
 assert.equal(soil.inside,false);
 assert.ok(soil.pos[1]+soil.size[1]/2<-plan.enclosure.h/2);
});
test('plan: deterministic',()=>{assert.deepEqual(planAssembly(node,modelSizeOf),plan);});
test('plan: parts that do not fit are laid beside the enclosure and flagged',()=>{
 const small={...node,enclosure:{...node.enclosure,sizeMm:{w:60,h:40,d:55}}};
 const p=planAssembly(small,modelSizeOf);
 assert.ok(p.items.some(i=>i.overflow&&i.pos[0]>p.enclosure.w/2));
});
test('kindTitle',()=>{assert.equal(kindTitle('lora-rfm95w'),'LoRa RFM95W');});

test('explode: 0 is assembled, 1 moves parts outward, enclosure stays',()=>{
 const at0=explodeAll(plan,0),at1=explodeAll(plan,1);
 for(const it of plan.items)assert.deepEqual(at0.get(it.id),it.pos);
 assert.deepEqual(at1.get('enclosure'),plan.items.at(-1)!.pos);
 const b=plan.items[0]!;
 assert.ok(at1.get(b.id)![2]>b.pos[2]);
 assert.equal(fractionOf(150),1);assert.equal(fractionOf(-5),0);
 const b0=planBounds(plan,0),b1=planBounds(plan,1);
 assert.ok(b1.max[2]>b0.max[2]||b1.min[1]<b0.min[1]);
 assert.deepEqual(explodedPos(b,0),b.pos);
});
test('isolate: isolation, hide, Esc order',()=>{
 let v=showAll();
 v=toggleHidden(v,'board');assert.equal(isVisible('board',v),false);
 v=isolate(v,['ds18b20-1']);assert.equal(isVisible('ds18b20-1',v),true);assert.equal(isVisible('enclosure',v),false);
 v=escape(v);assert.equal(v.isolated,null);assert.equal(isVisible('board',v),false);
 v=escape(v);assert.equal(isVisible('board',v),true);
});
test('measure and snap',()=>{
 const m=measure([0,0,0],[3,4,0]);
 assert.equal(m.mm,5);assert.equal(formatMm(300),'300.0 mm');
 const pts:[number,number,number][]=[[0,0,0],[100,0,0]];
 assert.deepEqual(snapToScreen(pts,p=>[p[0],p[1]],[98,3],14),[100,0,0]);
 assert.equal(snapToScreen(pts,p=>[p[0],p[1]],[50,50],14),null);
});
test('section plane keeps one side and cuts boxes it crosses',()=>{
 const min:[number,number,number]=[0,0,0],max:[number,number,number]=[10,10,10];
 const s={...initialSection(),enabled:true,axis:'x' as const,t:0.5};
 const p=plane(s,min,max);
 assert.deepEqual(p.normal,[-1,0,0]);assert.equal(p.constant,5);
 assert.ok(p.normal[0]*2+p.constant>0,'x=2 kept');assert.ok(p.normal[0]*8+p.constant<0,'x=8 cut away');
 assert.ok(cuts(s,[5,5,5],[4,4,4],min,max));assert.ok(!cuts(s,[1,1,1],[1,1,1],min,max));
});
test('view cube presets',()=>{
 assert.deepEqual(FACE_DIR.front,[0,0,1]);
 const e=combine(['front','right']);assert.ok(Math.abs(Math.hypot(...e)-1)<1e-9);
 assert.equal(nearestFace([0.1,0.9,0.2]),'top');assert.deepEqual(upFor(FACE_DIR.top),[0,0,-1]);
});
test('balloons keep their gap and stay inside the viewport',()=>{
 const items=Array.from({length:8},(_,i)=>({id:`i${i}`,ref:i+1,label:'x',ax:100+(i%2)*600,ay:200+i*3}));
 const out=layoutBalloons(items,800,500);
 for(const side of ['left','right'] as const){
  const col=out.filter(b=>b.side===side).sort((a,b)=>a.by-b.by);
  for(let i=1;i<col.length;i++)assert.ok(col[i]!.by-col[i-1]!.by>=25.9);
  for(const b of col)assert.ok(b.by<=500);
 }
});
test('three assembly builds the farm node, selection and visibility follow ids',()=>{
 const a=createNodeAssembly(node);
 assert.equal(a.objects.size,plan.items.length);
 a.setSelected('ds18b20-1');assert.equal(a.objects.get('ds18b20-1')!.sel.visible,true);assert.equal(a.objects.get('board')!.sel.visible,false);
 a.setVisibility({hidden:new Set(['board']),isolated:null});assert.equal(a.objects.get('board')!.root.visible,false);
 a.setExplode(1);assert.notDeepEqual(a.positionOf('board'),plan.items[0]!.pos);
 const b=a.bounds();assert.ok(b.max[0]>b.min[0]);
 assert.ok(a.pickables.every(p=>typeof p.userData.itemId==='string'));
 a.dispose();
});
test('every farm node plans without throwing',()=>{
 for(const n of spec.nodes){const p=planAssembly(n,modelSizeOf);assert.ok(p.items.length>=2);for(const i of p.items)assert.ok(i.pos.every(Number.isFinite));}
});
