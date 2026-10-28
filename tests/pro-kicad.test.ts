import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PartRecordSchema,type PartRecord} from '../packages/catalog/schema.js';
import {SystemSpecSchema} from '../packages/pro-contract/system-spec.js';
import {exportKicad} from '../packages/pro-tools/impl/kicad.js';

const cat=JSON.parse(readFileSync(new URL('../packages/catalog/fixtures/farm-parts.json',import.meta.url),'utf8')) as {parts:unknown[]};
const parts=new Map((cat.parts as PartRecord[]).map(p=>[PartRecordSchema.parse(p).identity.id,p]));
const lookup=(id:string)=>parts.get(id);
const spec=SystemSpecSchema.parse(JSON.parse(readFileSync(new URL('../packages/pro-contract/fixtures/farm-4-fields/spec.r1.json',import.meta.url),'utf8')));
const run=()=>exportKicad({projectId:'p1',nodeId:'node-melon'},{spec,lookup});
const text=(r:ReturnType<typeof run>,ext:string)=>{
 const zip=Buffer.from(r.zipBase64,'base64'),f=r.files.find(x=>x.name.endsWith(ext))!,i=zip.indexOf(Buffer.from(f.name))+f.name.length;
 return zip.subarray(i,i+f.bytes).toString('utf8');
};

test('kicad: files, balanced sexpr, every net in sch and pcb',()=>{
 const r=run();assert.equal(r.ok,true,JSON.stringify(r.issues.filter(i=>i.severity==='error')));
 assert.deepEqual(r.files.map(f=>f.name.split('.').pop()),['kicad_pro','kicad_sch','kicad_pcb','txt']);
 const pcb=text(r,'.kicad_pcb'),sch=text(r,'.kicad_sch');
 for(const s of [pcb,sch])assert.equal((s.match(/\(/g)??[]).length,(s.match(/\)/g)??[]).length);
 const nets=[...pcb.matchAll(/^ \(net (\d+) "(.+)"\)$/gm)].filter(m=>m[1]!=='0').map(m=>m[2]!);
 assert.ok(nets.length>=3);
 for(const nn of nets){assert.ok(sch.includes(`(global_label "${nn}"`),nn);assert.ok(pcb.includes(`"${nn}")`),nn);}
 assert.ok(!/\(segment|\(via/.test(pcb));assert.ok(pcb.includes('Edge.Cuts'));
});
test('kicad: no overlap, stable bytes, unknown node',()=>{
 const a=run(),b=run();
 assert.ok(!a.issues.some(i=>i.code==='kicad.overlap'||i.code==='kicad.off-board'));
 assert.deepEqual(a.files,b.files);assert.equal(a.zipBase64,b.zipBase64);
 assert.ok(a.issues.some(i=>i.code==='kicad.footprint-fallback'));
 assert.equal(exportKicad({projectId:'p1',nodeId:'nope'},{spec,lookup}).ok,false);
});
