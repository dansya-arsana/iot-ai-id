import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHardware,toIntelHex} from '../services/api/lab-hardware.js';
import {BridgeError,parseUnoBoards,type UnoBridge,type UnoBoard} from '../runtime/local-bridge/uno.js';
import {compareSerial} from '../apps/web/src/lab/hw/match.js';

const board:UnoBoard={port:'/dev/cu.usbmodem1101',label:'Arduino UNO',vid:'2341',pid:'0043',clone:false};
function fake(over:Partial<UnoBridge>={}){
 const calls:string[]=[];let hexText='';
 const emit:{line?:(t:string)=>void;end?:(r:any,m?:string)=>void}={};
 const bridge:UnoBridge={
  async detect(){return{toolchain:true,boards:[board]};},
  async upload(port,file){calls.push('upload:'+port);hexText=readFileSync(file,'utf8');},
  openSerial(port,onLine,onEnd){calls.push('serial:'+port);emit.line=onLine;emit.end=onEnd;return{close(){calls.push('close');}};},
  ...over,
 };
 return{bridge,calls,emit,hex:()=>hexText};
}
const b64=(n:number)=>Buffer.from(new Uint8Array(n).fill(0x0c)).toString('base64');
const ask=(h:ReturnType<typeof createHardware>,m:string,p:string,body?:unknown)=>h.handle(m,'/api/lab/hardware/'+p,new URLSearchParams(),async()=>body);

test('upload is refused until the human authorizes the port',async()=>{
 const f=fake();const trusted=new Map<string,number>();const h=createHardware({bridge:f.bridge,trusted});
 const r=await ask(h,'POST','upload',{port:board.port,flashBase64:b64(64)});
 assert.equal(r.status,403);assert.deepEqual(f.calls,[]);
});
test('trust then upload sends the exact bytes as Intel HEX',async()=>{
 const f=fake();const trusted=new Map<string,number>();const h=createHardware({bridge:f.bridge,trusted});
 assert.equal((await ask(h,'POST','trust',{port:board.port,authorize:true})).status,200);
 const r=await ask(h,'POST','upload',{port:board.port,flashBase64:b64(40)});
 assert.equal(r.status,200);assert.deepEqual(f.calls,['upload:'+board.port]);
 assert.equal(f.hex(),toIntelHex(new Uint8Array(40).fill(0x0c)));
 assert.match(f.hex(),/:00000001FF\n$/);
});
test('trust expires after 20 minutes and cannot target an undetected port',async()=>{
 let t=1000;const f=fake();const trusted=new Map<string,number>();const h=createHardware({bridge:f.bridge,trusted,now:()=>t});
 assert.equal((await ask(h,'POST','trust',{port:'/dev/cu.other',authorize:true})).status,404);
 await ask(h,'POST','trust',{port:board.port,authorize:true});
 t+=20*60000+1;
 assert.equal((await ask(h,'POST','upload',{port:board.port,flashBase64:b64(8)})).status,403);
});
test('error mapping: missing toolchain, disconnect, busy, failure, oversize',async()=>{
 const trusted=new Map<string,number>([[board.port,Date.now()+60000]]);
 const run=async(over:Partial<UnoBridge>,size=64)=>(await ask(createHardware({bridge:fake(over).bridge,trusted}),'POST','upload',{port:board.port,flashBase64:b64(size)})).status;
 assert.equal(await run({detect:async()=>({toolchain:false,boards:[]})}),424);
 assert.equal(await run({detect:async()=>({toolchain:true,boards:[]})}),410);
 assert.equal(await run({upload:async()=>{throw new BridgeError('busy','x');}}),409);
 assert.equal(await run({upload:async()=>{throw new BridgeError('upload_failed','avrdude');}}),502);
 assert.equal(await run({},40000),400);
});
test('serial streams timestamped lines, requires trust, reports end',async()=>{
 const f=fake();const trusted=new Map<string,number>();const h=createHardware({bridge:f.bridge,trusted});
 assert.equal((await ask(h,'POST','serial/start',{port:board.port})).status,403);
 trusted.set(board.port,Date.now()+60000);
 assert.equal((await ask(h,'POST','serial/start',{port:board.port})).status,200);
 f.emit.line!('LED ON');f.emit.line!('LED OFF');
 const s=await ask(h,'GET','serial') as any;assert.equal(s.data.lines.length,2);assert.equal(s.data.lines[1].n,2);
 f.emit.end!('disconnected','gone');
 assert.equal(((await ask(h,'GET','serial')) as any).data.end.code,'disconnected');
});
test('arduino-cli board list parsing finds UNOs by fqbn or VID/PID only',()=>{
 const out=JSON.stringify({detected_ports:[
  {port:{address:'/dev/cu.usbmodem1101',protocol:'serial',properties:{vid:'0x2341',pid:'0x0043'}},matching_boards:[{name:'Arduino Uno',fqbn:'arduino:avr:uno'}]},
  {port:{address:'/dev/cu.wchusbserial1',protocol:'serial',properties:{vid:'0x1A86',pid:'0x7523'}}},
  {port:{address:'/dev/cu.esp',protocol:'serial',properties:{vid:'0x10C4',pid:'0xEA60'}}},
  {port:{address:'/dev/cu.Bluetooth',protocol:'serial'}},
 ]});
 const found=parseUnoBoards(out);
 assert.deepEqual(found.map(b=>b.port),['/dev/cu.usbmodem1101','/dev/cu.wchusbserial1']);
 assert.equal(found[1].clone,true);assert.deepEqual(parseUnoBoards('nope'),[]);
});
test('match indicator is honest about period and value differences',()=>{
 const toggles=(period:number)=>Array.from({length:8},(_,i)=>({t:i*period,text:i%2?'LED OFF':'LED ON'}));
 assert.equal(compareSerial(toggles(500),toggles(520)).state,'same');
 const slow=compareSerial(toggles(500),toggles(900),'D8');
 assert.equal(slow.state,'differs');assert.match((slow as any).detail,/D8/);
 assert.equal(compareSerial(toggles(500),[{t:0,text:'x'}]).state,'waiting');
 const dist=(v:number)=>Array.from({length:6},(_,i)=>({t:i*100,text:`dist ${v+i%2} cm`}));
 assert.equal(compareSerial(dist(20),dist(21)).state,'same');
 assert.equal(compareSerial(dist(20),dist(80)).state,'differs');
});
