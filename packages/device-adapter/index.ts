/** Device adapter protocol v1 (ADR 008): manifest, JSON-RPC messages and the bridge-owned session state machine. */
import {z} from 'zod';

export const PROTOCOL_VERSION=1;
const id=z.string().regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)+$/,'Use vendor.family, lowercase');
const semver=z.string().regex(/^\d+\.\d+\.\d+(?:-[\w.]+)?$/);
const sha256=z.string().regex(/^[a-f0-9]{64}$/);
const channelId=z.string().regex(/^[a-z0-9_]+(?:\.[a-z0-9_]+)*$/).max(80);
const finite=z.number().finite();

export const TransportSchema=z.enum(['serial','rs485','can','can-fd','usb-hid','usb-bulk','ethernet','modbus-tcp','ethercat']);
export const QuantitySchema=z.enum(['position','angle','velocity','force','torque','current','voltage','temperature','humidity','pressure','taxel_array','image','boolean','count']);

export const ChannelSchema=z.object({
 id:channelId,
 kind:z.enum(['actuator','sensor']),
 quantity:QuantitySchema,
 unit:z.string().min(1).max(20),
 range:z.tuple([finite,finite]).refine(([min,max])=>min<max,'range min must be below max').optional(),
 shape:z.array(z.number().int().positive()).min(1).max(3).optional(),
 maxRateHz:z.number().positive().max(10000),
 control:z.enum(['position','velocity','force','current']).optional(),
}).strict().superRefine((c,ctx)=>{
 if(c.kind==='actuator'&&!c.control)ctx.addIssue({code:'custom',message:'Actuator channels declare a control mode'});
 if(c.kind==='actuator'&&!c.range)ctx.addIssue({code:'custom',message:'Actuator channels declare a range'});
 if(c.kind==='sensor'&&c.control)ctx.addIssue({code:'custom',message:'Sensor channels have no control mode'});
 if(c.quantity==='taxel_array'&&!c.shape)ctx.addIssue({code:'custom',message:'Array channels declare a shape'});
});
export type Channel=z.infer<typeof ChannelSchema>;

export const LimitSchema=z.object({channel:channelId,min:finite,max:finite}).strict().refine(l=>l.min<=l.max,'limit min must not exceed max');

export const AdapterManifestSchema=z.object({
 id,
 version:semver,
 protocolVersion:z.literal(PROTOCOL_VERSION),
 role:z.enum(['dut','rig']),
 vendor:z.string().min(1).max(80),
 devices:z.array(z.object({model:z.string().min(1).max(80),firmware:z.string().min(1).max(40)}).strict()).min(1).max(50),
 transports:z.array(TransportSchema).min(1),
 probe:z.object({
  usb:z.array(z.object({vid:z.number().int().min(0).max(0xffff),pid:z.number().int().min(0).max(0xffff).optional()}).strict()).max(20).default([]),
  baudRates:z.array(z.number().int().positive()).max(10).default([]),
  canBitrates:z.array(z.number().int().positive()).max(10).default([]),
  timeoutMs:z.number().int().min(50).max(10000),
 }).strict(),
 runtime:z.object({kind:z.enum(['python','node','binary']),entrypoint:z.string().min(1).max(200).refine(p=>!p.includes('..')&&!p.startsWith('/'),'Entrypoint must stay inside the package'),args:z.array(z.string().max(200)).max(20).default([])}).strict(),
 sdk:z.object({name:z.string().min(1).max(80),version:z.string().min(1).max(40),license:z.string().min(1).max(80),distribution:z.enum(['bundled','install-separately','none'])}).strict(),
 channels:z.array(ChannelSchema).min(1).max(512),
 safety:z.object({
  stopLatencyMs:z.number().int().positive().max(2000),
  heartbeatTimeoutMs:z.number().int().min(50).max(5000),
  requiresHardwareStop:z.boolean(),
  vendorLimits:z.array(LimitSchema).max(512),
 }).strict(),
 network:z.enum(['none','loopback','lan']).default('none'),
}).strict().superRefine((m,ctx)=>{
 const ids=new Set<string>();
 for(const c of m.channels){if(ids.has(c.id))ctx.addIssue({code:'custom',message:`Duplicate channel ${c.id}`});ids.add(c.id);}
 const actuators=m.channels.filter(c=>c.kind==='actuator');
 for(const l of m.safety.vendorLimits)if(!ids.has(l.channel))ctx.addIssue({code:'custom',message:`Limit for unknown channel ${l.channel}`});
 for(const a of actuators)if(!m.safety.vendorLimits.some(l=>l.channel===a.id))ctx.addIssue({code:'custom',message:`Actuator ${a.id} has no vendor limit`});
 if(m.role==='dut'&&actuators.length>0&&m.safety.stopLatencyMs>=m.safety.heartbeatTimeoutMs)ctx.addIssue({code:'custom',message:'stopLatencyMs must be below heartbeatTimeoutMs'});
});
export type AdapterManifest=z.infer<typeof AdapterManifestSchema>;

/** Signed registry entry: physical runs only load packages whose hash matches a signed entry. */
export const RegistryEntrySchema=z.object({id,version:semver,packageSha256:sha256,signature:z.string().min(16).max(2000),signedAt:z.string().datetime()}).strict();

// JSON-RPC 2.0 over newline-delimited stdio.
const rpcId=z.number().int().nonnegative();
const envelopeSchema=z.object({limits:z.array(LimitSchema).min(1).max(512)}).strict();
export type Envelope=z.infer<typeof envelopeSchema>;
const target=z.object({channel:channelId,value:finite}).strict();
const port=z.string().min(1).max(200);

const req=<M extends string,P extends z.ZodRawShape>(method:M,params:P)=>z.object({jsonrpc:z.literal('2.0'),id:rpcId,method:z.literal(method),params:z.object(params).strict()}).strict();
export const RequestSchema=z.discriminatedUnion('method',[
 req('hello',{protocolVersion:z.number().int().positive(),bridgeVersion:z.string().max(40)}),
 req('probe',{port,transport:TransportSchema}),
 req('connect',{port,transport:TransportSchema}),
 req('identify',{}),
 req('describe',{}),
 req('arm',{approvalToken:z.string().min(16).max(200),envelope:envelopeSchema}),
 req('command',{seq:z.number().int().nonnegative(),targets:z.array(target).min(1).max(512)}),
 req('read',{channels:z.array(channelId).min(1).max(512)}),
 req('stream',{channels:z.array(channelId).min(1).max(512),rateHz:z.number().positive().max(10000)}),
 req('heartbeat',{seq:z.number().int().nonnegative()}),
 req('stop',{reason:z.string().max(200)}),
 req('disarm',{}),
 req('disconnect',{}),
]);
export type AdapterRequest=z.infer<typeof RequestSchema>;
export type Method=AdapterRequest['method'];

export const IdentitySchema=z.object({model:z.string().min(1).max(80),serialNumber:z.string().min(1).max(120),firmware:z.string().min(1).max(40)}).strict();
export type DeviceIdentity=z.infer<typeof IdentitySchema>;
export const ProbeResultSchema=z.object({match:z.enum(['none','possible','confirmed']),identity:IdentitySchema.optional(),evidence:z.string().max(300)}).strict().refine(r=>r.match!=='confirmed'||!!r.identity,'A confirmed probe returns the device identity');

const sample=z.object({channel:channelId,value:z.union([finite,z.boolean(),z.array(finite).max(65536)]),deviceTime:finite.optional(),hostTime:finite}).strict();
export const NotificationSchema=z.discriminatedUnion('method',[
 z.object({jsonrpc:z.literal('2.0'),method:z.literal('telemetry'),params:z.object({samples:z.array(sample).min(1).max(4096)}).strict()}).strict(),
 z.object({jsonrpc:z.literal('2.0'),method:z.literal('fault'),params:z.object({code:z.string().max(60),severity:z.enum(['info','warning','critical']),message:z.string().max(300)}).strict()}).strict(),
 z.object({jsonrpc:z.literal('2.0'),method:z.literal('log'),params:z.object({level:z.enum(['debug','info','warn','error']),message:z.string().max(1000)}).strict()}).strict(),
]);
export type AdapterNotification=z.infer<typeof NotificationSchema>;

export const ResponseSchema=z.union([
 z.object({jsonrpc:z.literal('2.0'),id:rpcId,result:z.unknown()}).strict(),
 z.object({jsonrpc:z.literal('2.0'),id:rpcId,error:z.object({code:z.number().int(),message:z.string().max(300),data:z.unknown().optional()}).strict()}).strict(),
]);

// Session state machine, owned by the bridge and enforced again by every adapter.
export type SessionState='idle'|'connected'|'armed'|'faulted';
const allowed:Record<Method,SessionState[]>={hello:['idle','connected','armed','faulted'],probe:['idle'],connect:['idle'],identify:['connected','armed'],describe:['connected','armed'],arm:['connected'],command:['armed'],read:['connected','armed','faulted'],stream:['connected','armed'],heartbeat:['armed'],stop:['idle','connected','armed','faulted'],disarm:['armed','faulted'],disconnect:['connected','faulted']};
const next:Partial<Record<Method,SessionState>>={connect:'connected',arm:'armed',disarm:'connected',disconnect:'idle'};

export function canCall(state:SessionState,method:Method):boolean{return allowed[method].includes(state);}
/** State after a successful call; `stop` while armed drops to connected so motion needs a fresh approval. */
export function transition(state:SessionState,method:Method):SessionState{
 if(!canCall(state,method))throw new Error(`${method} is not allowed while ${state}`);
 if(method==='stop')return state==='armed'?'connected':state;
 return next[method]??state;
}
/** A critical fault, or a missed heartbeat while armed, moves the session to faulted. */
export function onFault(state:SessionState,severity:'info'|'warning'|'critical'):SessionState{return severity==='critical'&&state!=='idle'?'faulted':state;}

/** A run envelope must stay inside the vendor limits and only name actuator channels. */
export function envelopeErrors(manifest:AdapterManifest,envelope:Envelope):string[]{
 const errors:string[]=[];
 for(const l of envelope.limits){
  const channel=manifest.channels.find(c=>c.id===l.channel);
  if(!channel){errors.push(`Unknown channel ${l.channel}`);continue;}
  if(channel.kind!=='actuator'){errors.push(`${l.channel} is not an actuator`);continue;}
  const vendor=manifest.safety.vendorLimits.find(v=>v.channel===l.channel)!;
  if(l.min<vendor.min||l.max>vendor.max)errors.push(`${l.channel} envelope ${l.min}..${l.max} exceeds vendor limit ${vendor.min}..${vendor.max}`);
 }
 return errors;
}
/** Commands are rejected, never clamped, when a target leaves the armed envelope. */
export function commandErrors(envelope:Envelope,targets:{channel:string;value:number}[]):string[]{
 return targets.flatMap(t=>{const l=envelope.limits.find(x=>x.channel===t.channel);if(!l)return[`${t.channel} is not in the armed envelope`];return t.value<l.min||t.value>l.max?[`${t.channel} target ${t.value} outside ${l.min}..${l.max}`]:[];});
}
