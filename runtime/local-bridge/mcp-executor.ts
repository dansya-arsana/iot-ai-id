/** Trusted adapter for the pinned upstream Arduino MCP server. */
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {createHash} from 'node:crypto';
import {mkdir,writeFile,readdir,readFile,lstat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {RuntimeRequestSchema,type RuntimeRequest} from '../../packages/runtime-client/index.js';
import {canonicalJson} from '../../packages/evidence/index.js';
const root=fileURLToPath(new URL('../../',import.meta.url));
const builds=resolve(process.env.IOT_RUNTIME_BUILDS_PATH??resolve(root,'.runtime/builds'));
const hash=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
type Tool=Record<string,any>;
export type ToolCall=(name:string,args:Record<string,unknown>,timeout?:number)=>Promise<Tool>;
export function parseObservationFrames(stdout:string,request:Extract<RuntimeRequest,{action:'run'}>){
 const checks=new Map<string,Tool>();let handshake=false,latestCycle=0;const conflicts=new Set<string>();const rawSerial=stdout.split(/\r?\n/).filter(Boolean).slice(-200);
 for(const line of stdout.split(/\r?\n/)){let frame:Tool;try{frame=JSON.parse(line);}catch{continue;}
  if(!frame||typeof frame!=='object'||frame.marker!=='iot_observation'||['experimentId','contractHash','nonce'].some(key=>frame[key]!==request[key as keyof typeof request]))continue;
  if(!Number.isSafeInteger(frame.cycle)||frame.cycle<1||!['device_addresses','sensor_readings','oled_initialized','button_input','output_commanded','behavior_sequence'].includes(frame.check)||typeof frame.passed!=='boolean'||!frame.data||typeof frame.data!=='object'||Array.isArray(frame.data))continue;
  handshake=true;if(frame.cycle<latestCycle)continue;
  if(frame.cycle>latestCycle){latestCycle=frame.cycle;checks.clear();conflicts.clear();}
  const observation={check:frame.check,passed:frame.passed,data:frame.data};
  const existing=checks.get(frame.check);
  if(existing&&canonicalJson(existing)!==canonicalJson(observation))conflicts.add(frame.check);
  checks.set(frame.check,conflicts.has(frame.check)?{check:frame.check,passed:false,data:{error:'conflicting_cycle_observations'}}:observation);
 }
 return{handshake,checks:[...checks.values()],rawSerial};
}
export function normalizeDevices(result:Tool){return(result.data?.ports??[]).filter((p:Tool)=>typeof p.address==='string'&&p.protocol==='serial').map((p:Tool)=>{let original:Tool={};try{const raw=JSON.parse(result.raw?.stdout??'{}');original=(raw.detected_ports??[]).find((v:Tool)=>v.port?.address===p.address)?.port?.properties??{};}catch{/* Normalized metadata remains available. */}const properties=p.properties??[];const property=(name:string)=>properties.find((v:Tool)=>v.name?.toLowerCase()===name)?.value??Object.entries(original).find(([key])=>key.toLowerCase()===name)?.[1];const vidText=property('vid')??p.hardwareId?.match(/VID(?:_|:|=)([a-f0-9]{4})/i)?.[1];const vid=typeof vidText==='number'?vidText:typeof vidText==='string'?parseInt(vidText.replace(/^0x/,''),16):null;return{port:p.address,description:p.label??'Arduino CLI serial port',vid,pid:property('pid')??null,serialNumber:property('serial')??null,candidate:[0x10c4,0x1a86,0x0403,0x303a].includes(vid??-1),inferredFqbn:p.selectedFqbn??null};});}
async function binaryInventory(directory:string):Promise<Tool[]>{let entries;try{entries=await readdir(directory,{withFileTypes:true});}catch{return[];}const output:Tool[]=[];for(const entry of entries){const path=join(directory,entry.name);if(entry.isSymbolicLink())throw new Error('Unsafe binary symlink');if(entry.isDirectory())output.push(...await binaryInventory(path));else if(entry.name.endsWith('.bin')){const bytes=await readFile(path);output.push({name:path.slice(builds.length+1),sha256:hash(bytes),size:bytes.length});}}return output.sort((a,b)=>a.name.localeCompare(b.name));}
export async function executeRuntime(request:RuntimeRequest,call:ToolCall){
 const toolLogs:Tool[]=[];const invoke=async(name:string,args:Record<string,unknown>,timeout=60000)=>{const result=await call(name,args,timeout);toolLogs.push({name,input:args,result});return result;};
 const doctor=await invoke('arduino_cli_doctor',{});const toolchain=doctor.ok===true&&doctor.data?.installed===true;
 const detection=toolchain?await invoke('detect_hardware',{includeBoardDetails:false}):{ok:false,data:{ports:[]}};
 const devices=normalizeDevices(detection);const discovery={available:true,devices,boards:detection.data?.ports??[],toolchain,backend:'arduino-mcp-server',runtimeVersion:'0.2.8',toolLogs,boardProof:'USB metadata and inferred FQBN are candidates. Successful upload plus bound firmware handshake required.'};
 if(request.action==='detect')return discovery;
 if(hash(request.source)!==request.firmwareHash)throw new Error('Firmware digest mismatch');
 if(!request.source.includes('#include <Wire.h>'))throw new Error('Invalid supported firmware');
 if(!devices.some((p:Tool)=>p.port===request.port&&p.candidate))throw new Error('Select a currently detected USB serial candidate');
 if(!toolchain||!detection.ok)throw new Error('Arduino MCP discovery unavailable');
 if(!request.safetyContext?.wiring?.length)throw new Error('Validated contract safety context required');
 const work=join(builds,request.experimentId);await mkdir(builds,{recursive:true});
 try{await lstat(work);throw new Error('Experiment build directory already exists');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 const sketch=join(work,'room_monitor');await mkdir(sketch,{recursive:true});await writeFile(join(sketch,'room_monitor.ino'),request.source,{flag:'wx'});
 const checks:Tool[]=[];const base={source:'physical',toolLogs,checks,rawSerial:[] as string[]};
 const compiled=await invoke('compile_sketch',{sketchPath:sketch,fqbn:request.fqbn,exportBinaries:true,clean:true,autoInstallCore:false},330000);
 checks.push({check:'compiled',passed:compiled.ok===true,data:{success:compiled.ok===true,tool:compiled}});
 if(!compiled.ok)return{...base,runtimeError:'firmware_compile'};
 const binaries=await binaryInventory(sketch);
 const flashed=await invoke('upload_sketch',{sketchPath:sketch,port:request.port,fqbn:request.fqbn,autoInstallCore:false,unsafeSkipPreflight:false,safetyContext:request.safetyContext},330000);
 checks.push({check:'flashed',passed:flashed.ok===true,data:{success:flashed.ok===true,tool:flashed}});
 if(!flashed.ok)return{...base,binaries,runtimeError:'flash_failed'};
 const serial=await invoke('read_serial_snapshot',{port:request.port,baudRate:115200,durationMs:25000},35000);
 const parsed=parseObservationFrames(serial.raw?.stdout??'',request);
 checks.unshift({check:'board_detected',passed:serial.ok===true&&parsed.handshake,data:{boardId:serial.ok&&parsed.handshake?'esp32-devkit':null,port:request.port,proof:parsed.handshake?'Successful ESP32 upload + bound firmware handshake':'USB candidate only; no bound handshake'}});
 checks.push(...parsed.checks);
 return{...base,rawSerial:parsed.rawSerial,binaries,port:request.port,completedAt:new Date().toISOString(),runtimeError:serial.ok?undefined:'serial_capture'};
}
async function main(){let input='';for await(const chunk of process.stdin){input+=chunk;if(input.length>200000)throw new Error('Runtime input exceeded limit');}const request=RuntimeRequestSchema.parse(JSON.parse(input));const env:Record<string,string>={};for(const key of ['PATH','HOME','TMPDIR','ARDUINO_DIRECTORIES_DATA','ARDUINO_DIRECTORIES_DOWNLOADS','ARDUINO_DIRECTORIES_USER'])if(process.env[key])env[key]=process.env[key]!;env.ARDUINO_CLI_PATH=process.env.ARDUINO_CLI_PATH??process.env.ARDUINO_CLI??'arduino-cli';env.ARDUINO_SKETCH_ROOT=builds;
 const transport=new StdioClientTransport({command:process.execPath,args:[resolve(root,'node_modules/arduino-mcp-server/build/index.js')],env,stderr:'pipe'});transport.stderr?.on('data',()=>{});const client=new Client({name:'iot-ai-id-runtime',version:'0.1.0'});try{await client.connect(transport);const result=await executeRuntime(request,async(name,args,timeout)=>{const result=await client.callTool({name,arguments:args},undefined,{timeout});const payload=result.structuredContent??JSON.parse((result.content as any[]).find(c=>c.type==='text')?.text??'{}');return{...payload,ok:!result.isError&&payload.ok===true};});console.log(JSON.stringify(result));}finally{await client.close();await transport.close();}}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error instanceof Error?error.message:'Runtime failed');process.exitCode=1;});
