import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createConsentVerifier} from '../services/api/lab-consent.js';
const {mintConsent,askConsent}=createRequire(import.meta.url)('../apps/desktop/consent.cjs');
const S='secret',SHA='a'.repeat(64),SHA2='b'.repeat(64);
test('v2 ok then replayed',()=>{const v=createConsentVerifier(S);const t=mintConsent(S,'COM3',Date.now(),SHA);assert.equal(v.verify(t,'COM3',SHA),'ok');assert.equal(v.verify(t,'COM3',SHA),'replayed');});
test('wrong sha / wrong port',()=>{const v=createConsentVerifier(S);const t=mintConsent(S,'COM3',Date.now(),SHA);assert.equal(v.verify(t,'COM3',SHA2),'wrong_sha');assert.equal(v.verify(t,'COM4',SHA),'wrong_port');assert.equal(v.verify(t,'COM3',SHA),'ok');});
test('forged',()=>{const v=createConsentVerifier(S);const t=mintConsent('other',  'COM3',Date.now(),SHA);assert.equal(v.verify(t,'COM3',SHA),'invalid');
 const g=mintConsent(S,'COM3',Date.now(),SHA).split('.');g[1]=Buffer.from(JSON.stringify({port:'COM3',fileSha:SHA2,exp:Date.now()+1e4,nonce:'x'})).toString('base64url');assert.equal(v.verify(g.join('.'),'COM3',SHA2),'invalid');assert.equal(v.verify(undefined,'COM3',SHA),'invalid');});
test('v1 token cannot satisfy sha-bound call; v1 still works without sha',()=>{const v=createConsentVerifier(S);const t=mintConsent(S,'COM3');assert.equal(v.verify(t,'COM3',SHA),'wrong_sha');assert.equal(v.verify(t,'COM3'),'ok');});
test('expired',()=>{let n=1000;const v=createConsentVerifier(S,()=>n);const t=mintConsent(S,'COM3',1000,SHA);n=1e6;assert.equal(v.verify(t,'COM3',SHA),'expired');});
test('dialog shows node,file,sha prefix,port; cancel gives null; bad sha no dialog',async()=>{
 let shown:any;const d=(r:number)=>({showMessageBox:async(_p:any,o:any)=>{shown=o;return{response:r};}});
 const o={fileSha:SHA,node:'esp32-1',file:'fw.bin'};
 assert.ok(await askConsent(d(0),null,S,'COM3',o));
 for(const x of['esp32-1','fw.bin','a'.repeat(12),'COM3'])assert.ok((shown.message+shown.detail).includes(x));
 assert.equal(await askConsent(d(1),null,S,'COM3',o),null);
 shown=undefined;assert.equal(await askConsent(d(0),null,S,'COM3',{...o,fileSha:'zz'}),null);assert.equal(shown,undefined);});
test('v2 token without fileSha is rejected by the UNO verifier; v3 serial never passes it; nonce shared across verifiers',()=>{
 const v=createConsentVerifier(S);
 assert.equal(v.verify(mintConsent(S,'COM3',Date.now(),SHA),'COM3'),'wrong_sha');
 assert.equal(v.verify(mintConsent(S,'COM3',Date.now(),undefined,'serial'),'COM3'),'invalid');
 const t=mintConsent(S,'COM3');assert.equal(v.verify(t,'COM3'),'ok');assert.equal(createConsentVerifier(S).verify(t,'COM3'),'replayed');
});
