import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync,renameSync,chmodSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {z} from 'zod';
export const ProviderName=z.enum(['openai','typesafe']);
export type CredentialProvider=z.infer<typeof ProviderName>;
export const SecretInput=z.object({key:z.string().trim().min(8).max(4096).regex(/^[\x21-\x7e]+$/)}).strict();
export type CredentialSnapshot={openai?:string;typesafe?:string};
type Entry={nonce:string;ciphertext:string;tag:string;fingerprint:string;updatedAt:string;testedAt?:string;testStatus?:'connected'|'failed'};
/** Workspace owner vault. This does not establish multi-user identity or ownership. */
export class CredentialVault {
 private readonly master:Buffer;
 private readonly path:string;
 constructor(readonly directory:string){
  mkdirSync(directory,{recursive:true,mode:0o700});chmodSync(directory,0o700);
  const masterPath=join(directory,'master.key');
  if(!existsSync(masterPath)){try{writeFileSync(masterPath,randomBytes(32),{mode:0o600,flag:'wx'});}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;}}
  chmodSync(masterPath,0o600);this.master=readFileSync(masterPath);if(this.master.length!==32)throw new Error('Credential vault master key invalid');
  this.path=join(directory,'credentials.json');
 }
 private read():Partial<Record<CredentialProvider,Entry>>{if(!existsSync(this.path))return{};try{return JSON.parse(readFileSync(this.path,'utf8'));}catch{throw new Error('Credential vault unreadable');}}
 private write(entries:Partial<Record<CredentialProvider,Entry>>){const temporary=join(this.directory,`credentials-${randomBytes(8).toString('hex')}.tmp`);writeFileSync(temporary,JSON.stringify(entries),{mode:0o600,flag:'wx'});renameSync(temporary,this.path);chmodSync(this.path,0o600);}
 save(provider:CredentialProvider,key:string){const input=SecretInput.parse({key});const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',this.master,nonce);cipher.setAAD(Buffer.from(`iot-owner-v1:${provider}`));const ciphertext=Buffer.concat([cipher.update(input.key,'utf8'),cipher.final()]);const entries=this.read();entries[provider]={nonce:nonce.toString('base64'),ciphertext:ciphertext.toString('base64'),tag:cipher.getAuthTag().toString('base64'),fingerprint:createHash('sha256').update(input.key).digest('hex').slice(0,12),updatedAt:new Date().toISOString()};this.write(entries);}
 remove(provider:CredentialProvider){const entries=this.read();delete entries[provider];this.write(entries);}
 snapshot():CredentialSnapshot{const entries=this.read(),result:CredentialSnapshot={};for(const provider of ProviderName.options){const entry=entries[provider];if(!entry)continue;try{const decipher=createDecipheriv('aes-256-gcm',this.master,Buffer.from(entry.nonce,'base64'));decipher.setAAD(Buffer.from(`iot-owner-v1:${provider}`));decipher.setAuthTag(Buffer.from(entry.tag,'base64'));result[provider]=Buffer.concat([decipher.update(Buffer.from(entry.ciphertext,'base64')),decipher.final()]).toString('utf8');}catch{throw new Error('Credential vault integrity check failed');}}return result;}
 metadata(){const entries=this.read();return{scope:'workspace_owner' as const,providers:Object.fromEntries(ProviderName.options.map(provider=>{const entry=entries[provider];return[provider,entry?{configured:true,source:'vault',fingerprint:entry.fingerprint,updatedAt:entry.updatedAt,testedAt:entry.testedAt,testStatus:entry.testStatus??'untested'}:{configured:false,source:'none',testStatus:'untested'}];}))};}
 recordTest(provider:CredentialProvider,fingerprint:string,connected:boolean){const entries=this.read(),entry=entries[provider];if(entry?.fingerprint!==fingerprint)return;entry.testedAt=new Date().toISOString();entry.testStatus=connected?'connected':'failed';this.write(entries);}
}
/** Fixed endpoints only. Provider response bodies and thrown network details are never exposed. */
export async function testCredential(provider:CredentialProvider,key:string,request:typeof fetch=fetch){try{const response=await request(provider==='openai'?'https://api.openai.com/v1/models':'https://api.typesafe.ai/v1/systemone',{method:provider==='openai'?'GET':'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},...(provider==='typesafe'?{body:JSON.stringify({model:'jev-latest',state:{purpose:'Credential connection check'},questions:{connected:{type:'noul',instructions:'Return true.',criteria:{true:'Connection works',false:'Connection failed'}}}})}:{}),redirect:'error',signal:AbortSignal.timeout(15000)});await response.body?.cancel();return{connected:response.ok,message:response.ok?(provider==='openai'?'Koneksi API berhasil. Akses inferensi GPT-6.1 Sol belum diuji.':'Koneksi API TypeSafe berhasil.'):`Provider menolak koneksi (HTTP ${response.status}).`};}catch{return{connected:false,message:'Koneksi provider gagal atau melewati batas waktu.'};}}
