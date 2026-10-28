import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fetchFootprint} from '../services/ops/footprint-fetch.js';

const MOD='(footprint "R_0603" (layer "F.Cu"))';
test('fetches, caches by sha256, serves second call from cache',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'fp-'));let n=0,url='';
 const f=(async(u:string)=>{n++;url=u;return new Response(MOD);})as any;
 const a=await fetchFootprint({library:'Resistor_SMD',name:'R_0603'},{cacheDir:dir,fetchImpl:f});
 assert.equal(a.sexpr,MOD);assert.match(a.sha256,/^[a-f0-9]{64}$/);assert.match(a.license,/^CC-BY-SA-4.0/);
 assert.ok(url.startsWith('https://gitlab.com/kicad/libraries/kicad-footprints/'));assert.ok(url.includes('Resistor_SMD.pretty'));
 const b=await fetchFootprint({library:'Resistor_SMD',name:'R_0603'},{cacheDir:dir,fetchImpl:f});
 assert.equal(n,1);assert.equal(b.sha256,a.sha256);rmSync(dir,{recursive:true});
});
test('rejects traversal, odd chars, non-footprints, 404',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'fp-'));const never=(()=>{throw new Error('net');})as any;
 for(const [library,name] of [['..','x'],['a/b','x'],['Lib','../x'],['Lib','a b'],['Lib','..'],['Lib','x?y=1'],['','x']])await assert.rejects(fetchFootprint({library,name},{cacheDir:dir,fetchImpl:never}),/Invalid/);
 await assert.rejects(fetchFootprint({library:'L',name:'x'},{cacheDir:dir,fetchImpl:(async()=>new Response('<html>'))as any}),/Not a KiCad/);
 await assert.rejects(fetchFootprint({library:'L',name:'x'},{cacheDir:dir,fetchImpl:(async()=>new Response('',{status:404}))as any}),/not found/);
 rmSync(dir,{recursive:true});
});
