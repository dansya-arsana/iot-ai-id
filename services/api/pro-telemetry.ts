/** /api/pro/telemetry/*: READ-ONLY MQTT subscription to aiot/<projectId>/# on the user's own broker (LAN-first).
 * There is no publish path anywhere in this module: actuator commands are out of scope (physical actions need native consent).
 * Settings (broker url, optional credentials) live in a local 0600 file and the password is never returned. Payloads are untrusted. */
import {mkdir,readFile,writeFile,chmod} from 'node:fs/promises';
import {dirname} from 'node:path';
import {z} from 'zod';
import type {HwResult} from './pro-hardware.js';
export const TELEMETRY_RING=500,TELEMETRY_PAYLOAD_MAX=4096;
export interface MqttLink{subscribe(topic:string,cb:(err?:Error|null)=>void):void;end():void}
export interface MqttConnectOptions{url:string;username?:string;password?:string;onMessage(topic:string,payload:Buffer):void;onState(state:'connected'|'error'|'closed',message?:string):void}
/** Injectable so tests and CI never need a broker or the `mqtt` package. */
export type MqttConnector=(o:MqttConnectOptions)=>MqttLink;
export interface TelemetryMessage{topic:string;nodeId:string|null;at:number;payload:string;truncated:boolean}
const SettingsIn=z.object({url:z.string().max(200).regex(/^(mqtt|mqtts):\/\/[^\s@]+$/,'broker url must be mqtt:// or mqtts:// without credentials'),username:z.string().max(100).optional(),password:z.string().max(200).optional()}).strict();
const StartIn=z.object({projectId:z.string().regex(/^[A-Za-z0-9_-]{1,64}$/)}).strict();
interface Stored{url:string;username?:string;password?:string}
/** Only mqtt and mqtts, no credentials in the URL (they have their own fields). Also applied to files written by older builds. */
export const isBrokerUrl=(u:unknown):u is string=>typeof u==='string'&&u.length<=200&&/^(mqtt|mqtts):\/\/[^\s@]+$/.test(u);
/** Error text from the mqtt library can echo the URL or password; neither is ever kept or shown. */
export const redactSecrets=(msg:string,password?:string):string=>{let m=msg.replace(/(\w+:\/\/)[^\s/@]*@/g,'$1***@');if(password&&password.length>=3)m=m.split(password).join('***');return m.slice(0,200);};
/** Real connector. The `mqtt` package is loaded lazily; the integrator adds it to package.json. */
export const mqttConnector:MqttConnector=o=>{
 let client:any=null,ended=false;const pending:Array<()=>void>=[];
 if(!isBrokerUrl(o.url)){queueMicrotask(()=>o.onState('error','broker url must be mqtt:// or mqtts://'));return{subscribe(){},end(){}};}
 import('mqtt' as string).then((m:any)=>{
  if(ended)return;const lib=m.default??m;
  client=lib.connect(o.url,{username:o.username,password:o.password,reconnectPeriod:5000,connectTimeout:10000});
  client.on('connect',()=>{o.onState('connected');pending.splice(0).forEach(f=>f());});
  client.on('error',(e:Error)=>o.onState('error',e.message));client.on('close',()=>o.onState('closed'));
  client.on('message',(t:string,p:Buffer)=>o.onMessage(t,p));
 }).catch(e=>o.onState('error',`mqtt package unavailable: ${e?.message??e}`));
 return{subscribe(topic,cb){const go=()=>client.subscribe(topic,{qos:0},(e:Error|null)=>cb(e));if(client?.connected)go();else pending.push(go);},end(){ended=true;client?.end(true);}};
};
export function createProTelemetry(options:{settingsPath:string;connector?:MqttConnector;now?:()=>number}){
 const connector=options.connector??mqttConnector,now=options.now??Date.now;
 let link:MqttLink|null=null,projectId:string|null=null,state:'idle'|'connecting'|'connected'|'error'='idle',lastError:string|undefined,ring:TelemetryMessage[]=[];
 const load=async():Promise<Stored|null>=>{try{const j=JSON.parse(await readFile(options.settingsPath,'utf8')) as Stored;return isBrokerUrl(j?.url)?j:null;}catch{return null;}};
 const stop=()=>{link?.end();link=null;projectId=null;state='idle';};
 const status=()=>({state,projectId,error:lastError,buffered:ring.length});
 async function handle(method:string,path:string,query:URLSearchParams,readBody:()=>Promise<unknown>):Promise<HwResult>{
  if(path==='/settings'&&method==='GET'){const s=await load();return{status:200,data:{configured:!!s,url:s?.url??null,username:s?.username??null,hasPassword:!!s?.password}};}
  if(path==='/settings'&&method==='PUT'){
   const p=SettingsIn.safeParse(await readBody());if(!p.success)return{status:400,data:{error:'invalid_settings'}};
   await mkdir(dirname(options.settingsPath),{recursive:true});
   await writeFile(options.settingsPath,JSON.stringify(p.data),{mode:0o600});await chmod(options.settingsPath,0o600);
   stop();return{status:200,data:{ok:true}};
  }
  if(path==='/start'&&method==='POST'){
   const p=StartIn.safeParse(await readBody());if(!p.success)return{status:400,data:{error:'invalid_project'}};
   const s=await load();if(!s)return{status:409,data:{error:'not_configured'}};
   stop();ring=[];projectId=p.data.projectId;state='connecting';lastError=undefined;
   const root=`aiot/${projectId}/`;
   link=connector({url:s.url,username:s.username,password:s.password,
    onMessage(topic,payload){
     if(!topic.startsWith(root))return;
     const buf=payload.subarray(0,TELEMETRY_PAYLOAD_MAX);
     ring.push({topic,nodeId:topic.slice(root.length).split('/')[0]||null,at:now(),payload:buf.toString('utf8'),truncated:payload.length>TELEMETRY_PAYLOAD_MAX});
     if(ring.length>TELEMETRY_RING)ring.shift();
    },
    onState(st,message){if(st==='connected'){state='connected';link?.subscribe(`${root}#`,e=>{if(e){state='error';lastError=redactSecrets(e.message,s.password);}});}else if(st==='error'){state='error';lastError=message===undefined?undefined:redactSecrets(message,s.password);}else if(state==='connected')state='connecting';}});
   return{status:200,data:status()};
  }
  if(path==='/stop'&&method==='POST'){stop();return{status:200,data:status()};}
  if(path==='/status'&&method==='GET')return{status:200,data:status()};
  if(path==='/messages'&&method==='GET'){
   const max=Math.min(TELEMETRY_RING,Math.max(1,Number(query.get('max')??100)||100)),since=Number(query.get('sinceMs')??0)||0,node=query.get('nodeId');
   const cutoff=since>0?now()-since:0;
   const messages=ring.filter(m=>m.at>=cutoff&&(!node||m.nodeId===node)).slice(-max);
   return{status:200,data:{projectId,messages:messages.map(m=>({topic:m.topic,at:m.at,payload:m.payload,truncated:m.truncated})),untrusted:true}};
  }
  return{status:404,data:{error:'not_found'}};
 }
 return{handle,stop};
}
