/** motion-drivers group: 28BYJ-48 + ULN2003 (coil sequencing, step counting, speed limit), MG996R, IRF520 module, mini pump. */
import test from 'node:test';
import assert from 'node:assert/strict';
import type {BoardPin,Circuit,PartLink,PartSpec,PinSample,UnoPin} from '../apps/web/src/lab/contract.js';
import {EMPTY,createWorldModels} from '../apps/web/src/lab/sim/peripherals.js';
import {fieldPos} from '../apps/web/src/lab/sim/devices/stepper-28byj48.js';
import {rdsOn} from '../apps/web/src/lab/sim/devices/irf520-mosfet-module.js';
import {sec60,stallKgCm} from '../apps/web/src/lab/sim/devices/mg996r.js';

const env={setPin(){},setAdc(){},schedule(){},now:()=>0};
const link=(a:string,b:string):PartLink=>{const [pa,pp]=a.split('.'),[qa,qp]=b.split('.');return {a:{part:pa!,pin:pp!},b:{part:qa!,pin:qp!},color:'orange'};};
const part=(id:string,kind:string,net:Partial<Record<string,BoardPin>>={},props:Record<string,string|number|boolean>={}):PartSpec=>({id,kind,net,props});
const out=(duty:number,freqHz=490,highUs=0):PinSample=>({mode:'output',level:duty>0.5?1:0,duty,freqHz,highUs,analog:null});
type R=ReturnType<typeof createWorldModels>;
const st=(r:R,id:string)=>{const s=r.models.get(id)!.state();return (s.kind==='ext'?s.v:s) as Record<string,number|boolean|string>;};
const slice=(r:R,samples=EMPTY(),dtSec=0.01,cycles=0)=>{for(const m of r.models.values())m.update({samples,dtSec,cycles});};

// ---------- stepper + ULN2003 ----------
const IN=['D8','D9','D10','D11'] as const;
const stepperCircuit=(ratio='nominal',powered=true):Circuit=>({wires:[],parts:[
 part('drv','uln2003-driver',{IN1:'D8',IN2:'D9',IN3:'D10',IN4:'D11',...(powered?{'+':'5V','-':'GND'}:{'-':'GND'})}),
 part('stp','stepper-28byj48',{},{ratio}),
],links:[link('drv.OUT1','stp.BLU'),link('drv.OUT2','stp.PNK'),link('drv.OUT3','stp.YEL'),link('drv.OUT4','stp.ORG'),link('drv.COM','stp.RED')]});
/** Play coil masks (bit k = IN k+1) at a fixed interval, edge by edge with cycle stamps, then settle one slice. */
function play(r:R,masks:readonly number[],intervalMs:number,startMs=1):number{
 let level=0,t=startMs;
 const drv=r.models.get('drv')!;
 for(const m of masks){
  for(let k=0;k<4;k++){
   const want=(m>>k)&1;
   if((level>>k)&1&&!want||!((level>>k)&1)&&want)drv.onEdge!(IN[k]!,want as 0|1,Math.round(t*16000));
  }
  level=m;t+=intervalMs;
 }
 slice(r,EMPTY(),0.01,Math.round(t*16000));
 return t;
}
const FULL=[1,2,4,8],HALF=[1,3,2,6,4,12,8,9];
const rep=(seq:readonly number[],n:number):number[]=>Array.from({length:n},(_,i)=>seq[i%seq.length]!);

test('stepper: field position of a coil set (one coil = even beat, neighbours in between, opposite cancel)',()=>{
 assert.deepEqual([1,3,2,6,4,12,8,9].map(fieldPos),[0,1,2,3,4,5,6,7]);
 assert.equal(fieldPos(5),null);assert.equal(fieldPos(0),null);assert.equal(fieldPos(15),null);
 assert.equal(fieldPos(7),2);   // three coils act like the middle one
});
test('uln2003: an input high pulls its output to ground (0.9 V) and COM carries the supply; LEDs follow',()=>{
 const r=createWorldModels(stepperCircuit(),env);slice(r);
 const drv=r.models.get('drv')!;
 assert.equal(r.world.volts('stp','BLU'),null,'idle output is open');
 assert.equal(r.world.volts('stp','RED'),5);
 drv.onEdge!('D8',1,100);drv.onEdge!('D10',1,200);slice(r);
 assert.ok(Math.abs((r.world.volts('stp','BLU')??9)-0.9)<1e-9);
 assert.ok(Math.abs((r.world.volts('stp','YEL')??9)-0.9)<1e-9);
 assert.equal(r.world.volts('stp','PNK'),null);
 const s=st(r,'drv');assert.equal(s.inMask,5);assert.equal(s.outMask,5);assert.equal(s.powered,true);assert.equal(s.edges,2);
});
test('uln2003: without a supply nothing conducts and the motor stays dead',()=>{
 const r=createWorldModels(stepperCircuit('nominal',false),env);slice(r);
 r.models.get('drv')!.onEdge!('D8',1,100);slice(r);
 assert.equal(r.world.volts('stp','BLU'),null);
 assert.equal(st(r,'drv').powered,false);
 play(r,rep(FULL,200),2);
 const s=st(r,'stp');assert.equal(s.steps,0);assert.equal(s.powered,false);
});
test('stepper: 2048 full steps in order IN1..IN4 at 2 ms turn the shaft exactly once (64:1 label ratio), 4096 half steps likewise',()=>{
 const r=createWorldModels(stepperCircuit('nominal'),env);slice(r);
 play(r,rep(FULL,2048),2);
 let s=st(r,'stp');
 assert.equal(s.steps,2047,'the first field only settles the rotor, every later coil change is a step');
 assert.equal(s.missed,0);assert.equal(s.mode,'full');
 assert.equal(s.halfSteps,2*2047);
 const r2=createWorldModels(stepperCircuit('nominal'),env);slice(r2);
 play(r2,rep(HALF,4097),1);
 s=st(r2,'stp');
 assert.equal(s.halfSteps,4096);assert.equal(s.turns,1);assert.equal(s.angleDeg,0);assert.equal(s.mode,'half');assert.equal(s.missed,0);
});
test('stepper: the measured gearbox 63.68395:1 gives 4075.77 half steps per turn; the reverse order turns it back',()=>{
 const r=createWorldModels(stepperCircuit('actual'),env);slice(r);
 play(r,rep(HALF,1+4076),1);
 let s=st(r,'stp');
 assert.ok(Math.abs(s.turns as number-1.00006)<0.0005,`turns ${s.turns}`);
 assert.ok(Math.abs((s.angleDeg as number)-0.02)<0.1,`angle ${s.angleDeg}`);
 const r2=createWorldModels(stepperCircuit('nominal'),env);slice(r2);
 play(r2,rep(FULL,101),2);
 const fwd=st(r2,'stp').halfSteps as number;
 play(r2,rep([8,4,2,1],101),2,300);
 s=st(r2,'stp');
 assert.ok((s.halfSteps as number)<fwd,'reverse sequence moves back');
});
test('stepper: steps faster than about 500 full steps per second are lost (pull-in rate)',()=>{
 const r=createWorldModels(stepperCircuit('nominal'),env);slice(r);
 play(r,rep(FULL,400),0.5);   // 2000 full steps per second
 const s=st(r,'stp');
 assert.ok((s.missed as number)>=300,`missed ${s.missed}`);
 assert.equal(s.stalled,true);
 assert.ok(Math.abs(s.halfSteps as number)<20,'the rotor does not follow');
 const ok=createWorldModels(stepperCircuit('nominal'),env);slice(ok);
 play(ok,rep(FULL,400),2);
 assert.equal(st(ok,'stp').missed,0,'2 ms per full step (500/s) is fine');
});
test('stepper: wiring order matters (swap two coil wires and the sequence scrambles the direction)',()=>{
 const c=stepperCircuit('nominal');c.links=[link('drv.OUT1','stp.BLU'),link('drv.OUT3','stp.PNK'),link('drv.OUT2','stp.YEL'),link('drv.OUT4','stp.ORG'),link('drv.COM','stp.RED')];
 const r=createWorldModels(c,env);slice(r);
 play(r,rep(FULL,200),2);
 const good=createWorldModels(stepperCircuit('nominal'),env);slice(good);play(good,rep(FULL,200),2);
 assert.notEqual(st(r,'stp').halfSteps,st(good,'stp').halfSteps);
});
test('stepper: coils tied straight to the rails are read from voltages (no driver board)',()=>{
 const r=createWorldModels({wires:[],parts:[part('stp','stepper-28byj48',{BLU:'GND',RED:'5V'})]},env);slice(r);
 const s=st(r,'stp');assert.equal(s.coils,1);assert.equal(s.powered,true);assert.equal(s.steps,0,'the first field settles the rotor');
 const dead=createWorldModels({wires:[],parts:[part('stp','stepper-28byj48',{BLU:'GND'})]},env);slice(dead);
 assert.equal(st(dead,'stp').coils,0);assert.equal(st(dead,'stp').powered,false);
});

// ---------- MG996R ----------
test('mg996r: same pulse decoding as the SG90 (1472 us = 90 deg, 544 = 0, 2400 = 180) with a 5 us dead band',()=>{
 const mk=(extra:Record<string,string|number|boolean>={})=>createWorldModels({wires:[],parts:[part('s','mg996r',{SIG:'D9'},extra)]},env);
 const frame=(r:R,us:number,secs:number)=>{const s=EMPTY();s.D9=out(0.07,50,us);for(let t=0;t<secs;t+=0.01)slice(r,s,0.01);};
 const r=mk();frame(r,544,1);
 assert.equal(st(r,'s').angleDeg,0);assert.equal(st(r,'s').pulseUs,544);
 frame(r,2400,1);assert.equal(st(r,'s').angleDeg,180);
 frame(r,1472,1);assert.ok(Math.abs((st(r,'s').angleDeg as number)-90)<0.01);
 frame(r,1475,0.5);assert.equal(st(r,'s').pulseUs,1472,'3 us change is inside the dead band');
 frame(r,1500,0.5);assert.equal(st(r,'s').pulseUs,1500);
 const idle=mk();slice(idle);assert.equal(st(idle,'s').pulseUs,0);
});
test('mg996r: speed follows the supply (0.17 s/60 deg at 4.8 V, 0.14 s at 6 V) and a load above the stall torque holds it still',()=>{
 assert.ok(Math.abs(sec60(4.8)-0.17)<1e-9&&Math.abs(sec60(6)-0.14)<1e-9);
 assert.ok(Math.abs(stallKgCm(4.8)-9.4)<1e-9&&Math.abs(stallKgCm(6)-11)<1e-9);
 const run=(circuit:Circuit)=>{const r=createWorldModels(circuit,env);const s=EMPTY();s.D9=out(0.07,50,544);for(let t=0;t<0.1;t+=0.001)slice(r,s,0.001);return r;};
 // start at 90, command 0: after 100 ms the horn has moved speed x 0.1 s
 const at5=st(run({wires:[],parts:[part('s','mg996r',{SIG:'D9',V:'5V',GND:'GND'})]}),'s');
 const dps5=60/sec60(5);
 assert.ok(Math.abs((90-(at5.angleDeg as number))-dps5*0.1)<1,`5 V moved ${90-(at5.angleDeg as number)}`);
 const six:Circuit={wires:[],parts:[part('s','mg996r',{SIG:'D9',GND:'GND'}),part('b','battery-aa-4')],links:[link('b.PLUS','s.V')]};
 const at6=st(run(six),'s');
 assert.ok(at6.supplyV as number>5.5);
 assert.ok(90-(at6.angleDeg as number)>90-(at5.angleDeg as number),'more volts, faster');
 const loaded=st(run({wires:[],parts:[part('s','mg996r',{SIG:'D9',V:'5V',GND:'GND'},{loadKgCm:12})]}),'s');
 assert.equal(loaded.stalled,true);assert.equal(loaded.angleDeg,90);assert.equal(loaded.ma,2500);
});

// ---------- IRF520 module + pump ----------
test('irf520: RDS(on) follows the gate (not logic level): 0.27 ohm at 10 V, about 0.6 at 5 V, a few ohms at 3.3 V',()=>{
 assert.ok(Math.abs(rdsOn(10)-0.27)<1e-9);assert.ok(Math.abs(rdsOn(5)-0.6)<1e-9);
 assert.ok(rdsOn(3.3)>5&&rdsOn(3.3)<12);assert.ok(rdsOn(1.5)>=1e6);
 assert.ok(rdsOn(4.5)<rdsOn(4)&&rdsOn(4.5)>rdsOn(5));
});
const pumpCircuit=(sig:BoardPin='D9',props:Record<string,string|number|boolean>={},pump:Record<string,string|number|boolean>={}):Circuit=>({wires:[],parts:[
 part('fet','irf520-mosfet-module',{SIG:sig,VCC:'5V',GND:'GND'},{loadOhms:25,...props}),part('bat','battery-aa-4'),part('p','dc-pump',{},pump),
],links:[link('bat.PLUS','fet.VIN+'),link('bat.MINUS','fet.VIN-'),link('fet.V+','p.+'),link('fet.V-','p.-')]});
const runFet=(c:Circuit,duty:number,secs=1):R=>{const r=createWorldModels(c,env);const s=EMPTY();s.D9=out(duty);for(let t=0;t<secs;t+=0.01)slice(r,s,0.01);return r;};
test('irf520 + pump: gate high lets the battery run the pump; gate low or floating does not',()=>{
 const on=runFet(pumpCircuit(),1);
 const f=st(on,'fet'),p=st(on,'p');
 assert.equal(f.on,true);assert.equal(f.ledOn,true);assert.equal(f.rdsOhms,0.6);
 const vin=(on.world.volts('fet','VIN+')??0)-(on.world.volts('fet','VIN-')??0);
 assert.ok(vin>5.9&&vin<6.6,`4 x AA supply ${vin}`);
 assert.ok(Math.abs((f.loadV as number)-vin*25/25.6)<0.02,`loadV ${f.loadV}`);
 assert.ok((p.volts as number)>5.5&&(p.flowLh as number)>85,`pump ${JSON.stringify(p)}`);
 const off=runFet(pumpCircuit(),0);
 assert.equal(st(off,'fet').on,false);assert.equal(st(off,'p').flowLh,0);assert.equal(st(off,'p').volts,0,'a floating V- is an open circuit');
 const floating=runFet(pumpCircuit('A0'),0);
 assert.equal(st(floating,'p').flowLh,0);
});
test('irf520: PWM gives the average voltage; 3.3 V gate hardly switches; heat follows I^2 x RDS(on)',()=>{
 const half=runFet(pumpCircuit(),0.5);
 const hv=st(half,'fet').loadV as number;
 assert.ok(hv>2.9&&hv<3.4,`loadV ${hv}`);   // half of the 6.4 V pack, a little less across RDS(on)
 const lo=runFet(pumpCircuit('3V3'),1);
 assert.ok((st(lo,'fet').loadV as number)<(st(runFet(pumpCircuit(),1),'fet').loadV as number)-1&&(st(lo,'fet').rdsOhms as number)>5,'3.3 V gate: a few ohms in the switch, the pump gets clearly less');
 const hot=runFet(pumpCircuit('D9',{loadOhms:2}),1);
 const h=st(hot,'fet');
 assert.ok((h.watts as number)>1&&(h.tempC as number)>80,`watts ${h.watts} temp ${h.tempC}`);
});
test('pump: starts above 2 V, flow rises with the voltage, dry running is flagged and stops the flow',()=>{
 const at=(v:number,props:Record<string,string|number|boolean>={})=>{
  // a supply of v volts: tap the 9 V battery through the regulator-free route by giving the pump a fixed supply via the 5 V rail minus nothing:
  const c:Circuit={wires:[],parts:[part('b','battery-9v',{},{charge:100}),part('p','dc-pump',{},props)],links:[link('b.PLUS','p.+'),link('b.MINUS','p.-')]};
  void v;return c;
 };
 const wet=createWorldModels(at(0),env);for(let t=0;t<1;t+=0.01)slice(wet);
 assert.ok((st(wet,'p').flowLh as number)>95,'9.6 V is above the 6 V rating: full flow');
 const dry=createWorldModels(at(0,{submerged:false}),env);for(let t=0;t<12;t+=0.05)slice(dry,EMPTY(),0.05);
 const d=st(dry,'p');
 assert.equal(d.flowLh,0);assert.equal(d.dryRun,true);assert.equal(d.overheated,true);
 const none=createWorldModels({wires:[],parts:[part('p','dc-pump')]},env);slice(none);
 assert.equal(st(none,'p').flowLh,0);assert.equal(st(none,'p').ma,0);
 // PWM at 20 % averages to about 1.3 V: below the 2 V start voltage, so the impeller does not turn
 const weak=runFet(pumpCircuit(),0.2);
 assert.ok((st(weak,'p').volts as number)<2);assert.equal(st(weak,'p').flowLh,0);
 const mid=runFet(pumpCircuit(),0.6),full=runFet(pumpCircuit(),1);
 assert.ok((st(mid,'p').flowLh as number)>0&&(st(mid,'p').flowLh as number)<(st(full,'p').flowLh as number),'flow rises with the average voltage');
});
void (null as unknown as UnoPin);

// ---------- real firmware: a hand-written 28BYJ-48 driver on an Uno, through the ULN2003 board ----------
import {readFileSync} from 'node:fs';
import {createLabRunner} from '../apps/web/src/lab/sim/runner.js';
test('stepper + uln2003 on real firmware: full steps, half steps, a too-fast burst and the way back',()=>{
 const fx=JSON.parse(readFileSync(new URL('./fixtures/firmware/stepper-uln.json',import.meta.url),'utf8'));
 const r=createLabRunner();
 const c=stepperCircuit('nominal');
 r.load(fx.variant,{},c,fx.toolchain);r.start();
 const get=()=>{const s=r.snapshot().parts.stp!;return (s.kind==='ext'?s.v:{}) as Record<string,number|boolean|string>;};
 const wait=(word:string,maxMs=3000)=>{for(let t=0;t<maxMs&&!r.serialText().includes(word);t+=5)r.advance(5);assert.ok(r.serialText().includes(word),`${word} in ${r.serialText()}`);};
 wait('fwd');r.advance(10);
 let s=get();
 assert.equal(s.missed,0,'2 ms full steps are within the pull-in rate');
 assert.equal(s.halfSteps,2*299,'300 coil patterns: the first one only settles the rotor');
 assert.equal(s.mode,'full');
 wait('half');r.advance(10);
 s=get();
 assert.equal(s.missed,0,'1 ms half steps are fine');
 assert.equal(s.halfSteps,2*299+300,'300 half steps = 300 half-step units');
 assert.equal(s.mode,'half');
 const before=s.halfSteps as number;
 wait('fast');r.advance(10);
 s=get();
 assert.ok((s.missed as number)>=140,`missed ${s.missed}`);
 assert.ok(Math.abs((s.halfSteps as number)-before)<30,'a 2000 steps/s burst does not turn the shaft');
 wait('done');r.advance(10);
 s=get();
 assert.ok((s.halfSteps as number)<before,'the reverse script moved it back');
 assert.equal((r.snapshot().parts.drv as unknown as {v:{powered:boolean}}).v.powered,true);
});
