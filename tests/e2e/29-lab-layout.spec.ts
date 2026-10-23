import {test,expect} from '@playwright/test';
import {readdirSync} from 'node:fs';
import {grantLab} from './lab-access';

/**
 * Layout guard over EVERY lesson: parts never overlap each other or the Uno (per mesh, not per fat bounding box), no jumper is drawn in front of a
 * display's glass in the lesson's own camera view, and every part can be picked where it is shown. Reads the live scene (`__labScene.layoutReport`),
 * so a lesson added tomorrow is checked tomorrow with no edit here.
 */
const PUBLIC=process.env.E2E_PUBLIC??'http://iot.admin.localhost:8891';
test.beforeEach(({page})=>grantLab(page,PUBLIC));
const LESSONS=readdirSync(new URL('../../apps/web/src/lab/lessons/',import.meta.url)).filter(f=>f.endsWith('.ts')&&!['index.ts','kit.ts'].includes(f)).map(f=>f.replace(/\.ts$/,'')).sort();

type Box=[number,number,number,number,number,number];
interface Report{uno:Box;unoBoxes:Box[];parts:{id:string;kind:string;target?:string;box:Box;boxes:Box[]}[];glass:{id:string;box:Box}[];wires:{id:string}[];crossings:{wire:string;glass:string}[]}
type Hook={layoutReport():Report;project(t:string):{x:number;y:number;visible:boolean}|null};
const TOL=0.6;   // mm: meshes may touch (a plug in a socket), not interpenetrate
const hit=(a:Box,b:Box):boolean=>a[0]<b[3]-TOL&&b[0]<a[3]-TOL&&a[1]<b[4]-TOL&&b[1]<a[4]-TOL&&a[2]<b[5]-TOL&&b[2]<a[5]-TOL;
const firstHit=(A:Box[],B:Box[]):[Box,Box]|null=>{for(const a of A)for(const b of B)if(hit(a,b))return [a,b];return null;};
const fmt=(b:Box):string=>b.map(Math.round).join(',');

test('the lesson folder is not empty (the guard would pass vacuously)',()=>{expect(LESSONS.length).toBeGreaterThanOrEqual(26);});

for(const id of LESSONS){
 test(`layout ${id}: no overlapping parts, no wire across display glass, every part pickable`,async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await page.goto(`${PUBLIC}/lab/${id}?e2e=1`);
  await expect(page.locator('.lab')).toHaveAttribute('data-scene','ready',{timeout:30000});
  // let the camera settle before the projection checks mean anything
  await page.waitForTimeout(1500);
  const r=await page.evaluate(()=>(window as unknown as {__labScene:Hook}).__labScene.layoutReport());
  expect(r.unoBoxes.length,'the board was built').toBeGreaterThan(0);
  if(r.parts.length===0)return;   // the Board lesson has the Uno alone

  const overlaps:string[]=[];
  for(const [i,a] of r.parts.entries()){
   const u=firstHit(a.boxes,r.unoBoxes);
   if(u)overlaps.push(`${a.id} x UNO [${fmt(u[0])}] / [${fmt(u[1])}]`);
   for(const b of r.parts.slice(i+1)){
    if(a.target===b.id||b.target===a.id)continue;   // a plug seated in its socket (stepper in the ULN2003, bulb on its relay)
    const h=firstHit(a.boxes,b.boxes);
    if(h)overlaps.push(`${a.id} x ${b.id} [${fmt(h[0])}] / [${fmt(h[1])}]`);
   }
  }
  expect(overlaps,'parts overlapping each other or the board').toEqual([]);
  expect(r.crossings,'jumpers drawn in front of a display glass').toEqual([]);

  // every part must be visible from the lesson camera: project() reports false when another part hides its hotspot.
  // Resistors, capacitors and diodes (a few mm tall) may stand behind a taller neighbour on a crowded breadboard; their LED or sensor is what the lesson shows.
  const TINY=new Set(['resistor','capacitor','diode']);
  const hidden=await page.evaluate(ids=>ids.filter(i=>{const q=(window as unknown as {__labScene:Hook}).__labScene.project(i);return !q||!q.visible;}),r.parts.filter(p=>!TINY.has(p.kind)).map(p=>p.id));
  expect(hidden,'parts whose hotspot is hidden or off screen').toEqual([]);
 });
}

test('layout guard: a part moved onto the Uno is reported by the same predicate',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await page.goto(`${PUBLIC}/lab/blink?e2e=1`);
 await expect(page.locator('.lab')).toHaveAttribute('data-scene','ready',{timeout:30000});
 await page.waitForTimeout(800);
 const r=await page.evaluate(()=>(window as unknown as {__labScene:Hook}).__labScene.layoutReport());
 const led=r.parts[0]!;
 expect(firstHit(led.boxes,r.unoBoxes),'the real layout is clear of the board').toBeNull();
 // pretend the part sits on the board: a small box standing in the middle of the biggest board mesh must fire the same predicate
 const pcb=[...r.unoBoxes].sort((a,b)=>(b[3]-b[0])*(b[5]-b[2])-(a[3]-a[0])*(a[5]-a[2]))[0]!;
 const cx=(pcb[0]+pcb[3])/2,cz=(pcb[2]+pcb[5])/2;
 const shifted:Box[]=led.boxes.map(b=>[cx-2,pcb[1],cz-2,cx+2,Math.max(pcb[4],b[4]),cz+2] as Box);
 expect(firstHit(shifted,r.unoBoxes)).not.toBeNull();
});
