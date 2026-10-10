import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AdapterManifestSchema,ProbeResultSchema,RequestSchema,NotificationSchema,canCall,transition,onFault,envelopeErrors,commandErrors} from '../packages/device-adapter/index.js';

const example=JSON.parse(readFileSync('packages/device-adapter/examples/sim.hand.json','utf8'));
const manifest=AdapterManifestSchema.parse(example);

test('example manifest is valid and unsafe manifests are refused',()=>{
 assert.equal(manifest.network,'none');
 const without=(patch:(m:any)=>void)=>{const m=structuredClone(example);patch(m);return AdapterManifestSchema.safeParse(m).success;};
 assert.equal(without(m=>{m.safety.vendorLimits=m.safety.vendorLimits.slice(1);}),false,'actuator without vendor limit');
 assert.equal(without(m=>{delete m.channels[0].control;}),false,'actuator without control mode');
 assert.equal(without(m=>{m.channels[1].id='thumb.flex';}),false,'duplicate channel');
 assert.equal(without(m=>{m.safety.stopLatencyMs=400;}),false,'stop slower than heartbeat timeout');
 assert.equal(without(m=>{m.runtime.entrypoint='../escape.py';}),false,'entrypoint outside package');
 assert.equal(without(m=>{m.protocolVersion=2;}),false,'unknown protocol version');
 assert.equal(without(m=>{m.extra=true;}),false,'unknown field');
 assert.equal(without(m=>{delete m.channels[4].shape;}),false,'array channel without shape');
});

test('a confirmed probe must carry a device identity read from the device',()=>{
 assert.equal(ProbeResultSchema.safeParse({match:'confirmed',evidence:'usb vid matches'}).success,false);
 assert.equal(ProbeResultSchema.safeParse({match:'possible',evidence:'FTDI dongle, no handshake'}).success,true);
 assert.equal(ProbeResultSchema.safeParse({match:'confirmed',identity:{model:'SimHand-6',serialNumber:'SH-001',firmware:'1.2.0'},evidence:'handshake'}).success,true);
});

test('requests and notifications are strict JSON-RPC 2.0',()=>{
 assert.equal(RequestSchema.safeParse({jsonrpc:'2.0',id:1,method:'command',params:{seq:1,targets:[{channel:'thumb.flex',value:30}]}}).success,true);
 assert.equal(RequestSchema.safeParse({jsonrpc:'2.0',id:1,method:'command',params:{seq:1,targets:[{channel:'thumb.flex',value:Infinity}]}}).success,false);
 assert.equal(RequestSchema.safeParse({jsonrpc:'2.0',id:2,method:'probe',params:{port:'/dev/ttyUSB0',transport:'rs485',write:true}}).success,false);
 assert.equal(RequestSchema.safeParse({jsonrpc:'2.0',id:3,method:'flash',params:{}}).success,false);
 assert.equal(RequestSchema.safeParse({jsonrpc:'2.0',id:4,method:'arm',params:{approvalToken:'short',envelope:{limits:[{channel:'thumb.flex',min:0,max:40}]}}}).success,false);
 assert.equal(NotificationSchema.safeParse({jsonrpc:'2.0',method:'fault',params:{code:'overcurrent',severity:'critical',message:'thumb motor'}}).success,true);
 assert.equal(NotificationSchema.safeParse({jsonrpc:'2.0',method:'telemetry',params:{samples:[{channel:'palm.taxels',value:[1,2,3,4],hostTime:1}]}}).success,true);
});

test('state machine: no motion without arming, stop needs fresh approval, critical faults latch',()=>{
 assert.equal(canCall('idle','command'),false);
 assert.equal(canCall('connected','command'),false);
 assert.equal(canCall('connected','probe'),false,'probe is only for unclaimed ports');
 let s=transition('idle','connect');assert.equal(s,'connected');
 s=transition(s,'arm');assert.equal(s,'armed');
 assert.equal(transition(s,'command'),'armed');
 assert.equal(transition(s,'stop'),'connected');
 assert.equal(onFault('armed','critical'),'faulted');
 assert.equal(onFault('armed','warning'),'armed');
 assert.equal(canCall('faulted','arm'),false);
 assert.equal(canCall('faulted','stop'),true);
 assert.equal(transition('faulted','disarm'),'connected');
 assert.throws(()=>transition('faulted','command'),/not allowed while faulted/);
 for(const state of ['idle','connected','armed','faulted'] as const)assert.equal(canCall(state,'stop'),true,`stop is always callable (${state})`);
});

test('envelopes stay inside vendor limits and commands are rejected, never clamped',()=>{
 assert.deepEqual(envelopeErrors(manifest,{limits:[{channel:'thumb.flex',min:0,max:60}]}),[]);
 assert.match(envelopeErrors(manifest,{limits:[{channel:'thumb.flex',min:0,max:90}]})[0],/exceeds vendor limit/);
 assert.match(envelopeErrors(manifest,{limits:[{channel:'grip.force',min:0,max:10}]})[0],/not an actuator/);
 assert.match(envelopeErrors(manifest,{limits:[{channel:'pinky.flex',min:0,max:10}]})[0],/Unknown channel/);
 const envelope={limits:[{channel:'thumb.flex',min:0,max:60}]};
 assert.deepEqual(commandErrors(envelope,[{channel:'thumb.flex',value:45}]),[]);
 assert.match(commandErrors(envelope,[{channel:'thumb.flex',value:61}])[0],/outside 0..60/);
 assert.match(commandErrors(envelope,[{channel:'index.flex',value:10}])[0],/not in the armed envelope/);
});
