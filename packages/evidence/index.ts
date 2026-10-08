import {recipeContractErrors,resolveRecipe} from '../recipe-registry/index.js';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {CHECKS,type HardwareContract,type CheckName} from '../hardware-contract/index.js';
export function hashText(text:string){return createHash('sha256').update(text).digest('hex');}
export function canonicalJson(value:unknown):string {if(Array.isArray(value))return`[${value.map(canonicalJson).join(',')}]`;if(value&&typeof value==='object')return`{${Object.keys(value).sort().filter(k=>(value as Record<string,unknown>)[k]!==undefined).map(k=>`${JSON.stringify(k)}:${canonicalJson((value as Record<string,unknown>)[k])}`).join(',')}}`;return JSON.stringify(value);}
export function contractHash(contract:HardwareContract){return hashText(canonicalJson(contract));}
export const IdentitySchema=z.object({experimentId:z.string().min(1),contractHash:z.string().regex(/^[a-f0-9]{64}$/),firmwareHash:z.string().regex(/^[a-f0-9]{64}$/),nonce:z.string().min(1)});
export type RunIdentity=z.infer<typeof IdentitySchema>;
export const EvidenceSchema=IdentitySchema.extend({id:z.string().min(1),source:z.enum(['physical','simulation']),timestamp:z.string().datetime(),check:z.enum(CHECKS),passed:z.boolean(),artifactHash:z.string().regex(/^[a-f0-9]{64}$/),artifactId:z.string().min(1),data:z.record(z.string(),z.unknown())});
export type Evidence=z.infer<typeof EvidenceSchema>;
export interface VerificationResult {status:'VERIFIED'|'SIMULATED_VERIFIED'|'FAILED';passed:boolean;physical:boolean;errors:string[];checks:Record<string,boolean>}
/** Pure verification: callers must resolve artifacts and validate their content hash before supplying evidence. */
export function verifyEvidence(contract:HardwareContract,identity:RunIdentity,inputs:unknown[]):VerificationResult{
 const errors:string[]=[],checks:Record<string,boolean>={},rows:Evidence[]=[];
 if(contractHash(contract)!==identity.contractHash)errors.push('Current contract hash differs from run identity.');
 for(const input of inputs){const p=EvidenceSchema.safeParse(input);if(!p.success){errors.push('Malformed evidence.');continue;}const row=p.data;if(['experimentId','contractHash','firmwareHash','nonce'].some(k=>row[k as keyof RunIdentity]!==identity[k as keyof RunIdentity])){errors.push('Stale or mismatched evidence identity.');continue;}rows.push(row);}
 const recipe=resolveRecipe(contract);
 errors.push(...recipeContractErrors(contract));
 const required=new Set<CheckName>(recipe?.checks??CHECKS);
 for(const check of required){const found=rows.filter(r=>r.check===check);let ok=found.length===1&&found[0].passed;if(found.length===1){const d=found[0].data;
  if(check==='board_detected')ok&&=d.boardId===contract.board.id;
  if(check==='compiled')ok&&=d.success===true;
  if(check==='flashed')ok&&=d.success===true;
  if(check==='device_addresses')ok&&=Array.isArray(d.addresses)&&contract.expected.devices.every(x=>(d.addresses as unknown[]).includes(x.address));
  if(check==='sensor_readings')ok&&=Object.entries(recipe?.valueRanges??{}).every(([key,[min,max]])=>typeof d[key]==='number'&&Number.isFinite(d[key])&&(d[key] as number)>=min&&(d[key] as number)<=max);
  if(check==='oled_initialized')ok&&=d.initialized===true&&d.addressAck===true;
 }checks[check]=ok;if(!ok)errors.push(`Required check failed or missing: ${check}`);}
 const sources=new Set(rows.map(r=>r.source));if(sources.size!==1)errors.push('Evidence sources must be consistent.');const physical=sources.size===1&&sources.has('physical');const passed=errors.length===0;return{status:passed?(physical?'VERIFIED':'SIMULATED_VERIFIED'):'FAILED',passed,physical:passed&&physical,errors,checks};
}
