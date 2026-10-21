import test from 'node:test';
import assert from 'node:assert/strict';
import {AssemblyPlayer,mapSpecWires,planSteps,T,type Stage,type StepEvent} from '../apps/web/src/lab/scene/assembly.js';
import {EXAMPLE_CLOSE_ALARM as SPEC} from '../apps/web/src/lab/circuit-examples.js';
import {specToCircuit} from '../apps/web/src/lab/circuit-spec.js';

function fake(){
 const log:string[]=[];const k:Record<string,number>={};let fin=0;
 const stage:Stage={
  board:v=>{k.board=v;},breadboard:v=>{k.bb=v;},
  part:(id,v)=>{k['p:'+id]=v;},wire:(id,v)=>{k['w:'+id]=v;},
  frame:(_s,i)=>{log.push('frame'+i);},finish:()=>{fin++;},
 };
 return {stage,k,log,fin:()=>fin};
}
const run=(p:AssemblyPlayer,ms:number,dt=16):void=>{for(let t=0;t<ms;t+=dt)p.tick(dt);};

test('wire ids map onto circuit wires in order',()=>{
 const m=mapSpecWires(SPEC,specToCircuit(SPEC));
 assert.equal(m.size,SPEC.wires.length);
 assert.deepEqual([...m.values()],SPEC.wires.map((_,i)=>i));
});
test('plan: every part and wire gets one item, steps do not overlap',()=>{
 const {plans,totalMs}=planSteps(SPEC);
 const ids=plans.flatMap(p=>p.items.map(i=>i.kind+':'+i.id));
 assert.equal(ids.length,SPEC.parts.length+SPEC.wires.length);
 for(let i=1;i<plans.length;i++)assert.ok(plans[i]!.start>=plans[i-1]!.end);
 assert.equal(plans.at(-1)!.end,totalMs);
});
test('plays steps in order, then resolves and finishes once',async()=>{
 const f=fake();const ev:StepEvent[]=[];
 const p=new AssemblyPlayer(SPEC,f.stage,{onStep:e=>ev.push(e)});
 const done=p.start();
 run(p,60000);
 await done;
 assert.equal(p.state().status,'done');
 assert.equal(f.fin(),1);
 assert.deepEqual(ev.map(e=>e.phase+e.index).slice(0,4),['start0','end0','start1','end1']);
 assert.equal(ev.length,16);
 for(const v of Object.values(f.k))assert.equal(v,1);
});
test('a part is not drawn before its step starts',()=>{
 const f=fake();const p=new AssemblyPlayer(SPEC,f.stage,{});void p.start();
 run(p,T.introEnd-50);
 assert.equal(f.k['p:us1']??0,0);
 assert.equal(f.k.board,1);
 run(p,200);
 assert.ok((f.k['p:us1']??0)>0);
});
test('pause holds time, resume continues',()=>{
 const f=fake();const p=new AssemblyPlayer(SPEC,f.stage,{});void p.start();
 run(p,500);const t0=p.state().timeMs;
 p.pause();run(p,500);assert.equal(p.state().timeMs,t0);assert.equal(p.state().status,'paused');
 p.resume();run(p,100);assert.ok(p.state().timeMs>t0);
});
test('speed 2 is twice as fast',()=>{
 const a=new AssemblyPlayer(SPEC,fake().stage,{speed:2}),b=new AssemblyPlayer(SPEC,fake().stage,{speed:1});
 void a.start();void b.start();run(a,1000);run(b,1000);
 assert.ok(Math.abs(a.state().timeMs-2*b.state().timeMs)<40);
});
test('skip jumps to the end of the current step and starts the next',()=>{
 const f=fake();const ev:StepEvent[]=[];
 const p=new AssemblyPlayer(SPEC,f.stage,{onStep:e=>ev.push(e)});void p.start();
 run(p,T.introEnd+100);
 p.skip();
 assert.ok(ev.some(e=>e.phase==='end'&&e.index===0));
 assert.equal(f.k['p:us1'],1);
 p.skipAll();assert.equal(p.state().status,'done');assert.equal(f.fin(),1);
 assert.equal(ev.filter(e=>e.phase==='end').length,8);
});
test('abort rejects with AbortError and restores the scene',async()=>{
 const f=fake();const ac=new AbortController();
 const p=new AssemblyPlayer(SPEC,f.stage,{signal:ac.signal});const done=p.start();
 run(p,800);ac.abort();
 await assert.rejects(done,(e:Error)=>e.name==='AbortError');
 assert.equal(f.fin(),1);p.tick(100);assert.equal(f.fin(),1);
});
test('speed 0 (reduced motion) completes synchronously with every step reported and no camera moves',async()=>{
 const f=fake();const ev:StepEvent[]=[];
 const p=new AssemblyPlayer(SPEC,f.stage,{speed:0,onStep:e=>ev.push(e)});
 await p.start();
 assert.equal(ev.length,16);assert.equal(f.log.length,0);assert.equal(f.fin(),1);
 for(const v of Object.values(f.k))assert.equal(v,1);
});
