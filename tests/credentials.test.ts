import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,statSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {z} from 'zod';
import {CredentialVault,testCredential,SecretInput} from '../services/api/credentials.js';
import {JevProvider} from '../services/orchestrator/provider.js';
import {execute} from '../services/orchestrator/process.js';

test('vault encrypts secrets, persists across restart, isolates providers and deletes',()=>{
 const dir=mkdtempSync(join(tmpdir(),'iot-vault-'));try{const vault=new CredentialVault(dir),openai='nonstandard-openai-secret-value',typesafe='typesafe-secret-value';vault.save('openai',openai);vault.save('typesafe',typesafe);
 assert.deepEqual(new CredentialVault(dir).snapshot(),{openai,typesafe});const disk=readFileSync(join(dir,'credentials.json'),'utf8');assert.ok(!disk.includes(openai)&&!disk.includes(typesafe));assert.ok(!JSON.stringify(vault.metadata()).includes(openai));assert.equal(vault.metadata().providers.openai.testStatus,'untested');
 if(process.platform!=='win32'){assert.equal(statSync(join(dir,'master.key')).mode&0o777,0o600);assert.equal(statSync(join(dir,'credentials.json')).mode&0o777,0o600);}
 const fingerprint=vault.metadata().providers.openai.fingerprint!;vault.save('openai','replacement-openai-secret');vault.recordTest('openai',fingerprint,true);assert.equal(vault.metadata().providers.openai.testStatus,'untested','Old test cannot bless replacement');vault.remove('openai');assert.deepEqual(new CredentialVault(dir).snapshot(),{typesafe});
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('vault rejects tampering and swapping provider ciphertext',()=>{const dir=mkdtempSync(join(tmpdir(),'iot-vault-'));try{const vault=new CredentialVault(dir);vault.save('openai','first-provider-secret');vault.save('typesafe','second-provider-secret');const path=join(dir,'credentials.json'),entries=JSON.parse(readFileSync(path,'utf8'));[entries.openai,entries.typesafe]=[entries.typesafe,entries.openai];writeFileSync(path,JSON.stringify(entries));assert.throws(()=>vault.snapshot(),/integrity/);}finally{rmSync(dir,{recursive:true,force:true});}});
test('credential inputs reject extra fields and tests expose no provider response body or network secret',async()=>{
 assert.equal(SecretInput.safeParse({key:'valid-key',baseUrl:'https://evil.example'}).success,false);
 for(const provider of ['openai','typesafe'] as const){let target='';const result=await testCredential(provider,'arbitrary-secret',async(url,options)=>{target=String(url);assert.equal(new Headers(options?.headers).get('Authorization'),'Bearer arbitrary-secret');assert.equal(options?.redirect,'error');if(provider==='typesafe'){assert.equal(options?.method,'POST');const body=JSON.parse(String(options?.body));assert.equal(body.model,'jev-latest');assert.equal(body.questions.connected.type,'noul');assert.deepEqual(Object.keys(body).sort(),['model','questions','state']);}return new Response('arbitrary-secret',{status:401});});assert.equal(target,provider==='openai'?'https://api.openai.com/v1/models':'https://api.typesafe.ai/v1/systemone');assert.equal(result.connected,false);assert.ok(!JSON.stringify(result).includes('arbitrary-secret'));}
 const result=await testCredential('openai','arbitrary-secret',async()=>{throw new Error('arbitrary-secret');});assert.ok(!JSON.stringify(result).includes('arbitrary-secret'));
});
test('simultaneous explicit OpenAI providers use their own keys and invalid keys never fallback',async()=>{
 const previous=globalThis.fetch;const seen:string[]=[];globalThis.fetch=async(_url,options)=>{const authorization=new Headers(options?.headers).get('Authorization')!;seen.push(authorization);await new Promise(resolve=>setTimeout(resolve,5));return authorization.includes('invalid')?new Response('key echoed invalid',{status:401}):Response.json({output:[{content:[{type:'output_text',text:'{"ok":true}'}]}]});};
 try{const first=new JevProvider(()=>({openai:'first-secret'})),second=new JevProvider(()=>({openai:'second-secret'}));await Promise.all([first.frontier('test',z.object({ok:z.boolean()})),second.frontier('test',z.object({ok:z.boolean()}))]);assert.deepEqual(seen.sort(),['Bearer first-secret','Bearer second-secret']);await assert.rejects(new JevProvider(()=>({openai:'invalid-secret'})).frontier('test',z.object({ok:z.boolean()})),/HTTP 401/);assert.equal(seen.length,3);}finally{globalThis.fetch=previous;}
});
test('Jev child environment is isolated and error output redacts exact nonstandard keys',async()=>{
 const key='secret-with-no-standard-prefix';const before=process.env.TYPESAFE_API_KEY;
 assert.equal(await execute(process.execPath,['-e','process.stdout.write(process.env.TYPESAFE_API_KEY)'],'',1000,undefined,{...process.env,TYPESAFE_API_KEY:key}),key);
 await assert.rejects(execute(process.execPath,['-e','console.error(process.env.TYPESAFE_API_KEY);process.exit(1)'],'',1000,undefined,{...process.env,TYPESAFE_API_KEY:key}),error=>{assert.ok(!String(error).includes(key));assert.match(String(error),/redacted/);return true;});assert.equal(process.env.TYPESAFE_API_KEY,before);
});
test('plan keeps one credential snapshot when key is deleted during operation',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'iot-provider-snapshot-')),vault=new CredentialVault(join(dir,'vault')),bin=join(dir,'jev');const previousBin=process.env.JEV_CODEX_BIN,previousFetch=globalThis.fetch;vault.save('openai','snapshot-secret');vault.save('typesafe','routing-secret');writeFileSync(bin,`#!${process.execPath}\nprocess.stdout.write(JSON.stringify({tier:'main',keyPresent:process.env.TYPESAFE_API_KEY==='routing-secret'}));\n`,{mode:0o700});process.env.JEV_CODEX_BIN=bin;
 let reads=0,authorization='';globalThis.fetch=async(_url,options)=>{authorization=new Headers(options?.headers).get('Authorization')!;return Response.json({output:[{content:[{type:'output_text',text:JSON.stringify({supported:false,recipe:'esp32-button-led',title:'Unsupported',summary:'Clarify',steps:[],clarification:'Clarify goal'})}]}]});};
 try{const provider=new JevProvider(()=>{reads++;const snapshot=vault.snapshot();vault.remove('openai');return snapshot;});const result=await provider.plan('Unsupported hardware goal',{});assert.equal(reads,1);assert.equal(authorization,'Bearer snapshot-secret');assert.equal((result.route as any).keyPresent,true);assert.equal(vault.snapshot().openai,undefined);}
 finally{globalThis.fetch=previousFetch;if(previousBin===undefined)delete process.env.JEV_CODEX_BIN;else process.env.JEV_CODEX_BIN=previousBin;rmSync(dir,{recursive:true,force:true});}
});
