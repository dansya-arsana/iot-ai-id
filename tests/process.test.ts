import test from 'node:test';
import assert from 'node:assert/strict';
import {execute} from '../services/orchestrator/process.js';
test('timeout waits for termination even when executor ignores SIGTERM',async()=>{const started=Date.now();await assert.rejects(execute(process.execPath,['-e',"process.on('SIGTERM',()=>{});setInterval(()=>{},1000)"],'',200),/timed out/);assert.ok(Date.now()-started>=2100);});
test('fixed argv does not expand shell tokens and handles spawn failure',async()=>{assert.equal(await execute(process.execPath,['-e','process.stdout.write(process.argv[1])','$(echo unexpected)'],'',1000),'$(echo unexpected)');await assert.rejects(execute('/nonexistent/iot-executor',[],'',1000),/ENOENT/);});

test('provider preflight names missing Jev dependency explicitly',async()=>{
 const {JevProvider}=await import('../services/orchestrator/provider.js');
 const previous=process.env.JEV_CODEX_BIN;
 process.env.JEV_CODEX_BIN='/missing-iot-test/jev-codex';
 try{await assert.rejects(new JevProvider().preflight(),/Jev provider unavailable.*JEV_CODEX_BIN/);}finally{if(previous===undefined)delete process.env.JEV_CODEX_BIN;else process.env.JEV_CODEX_BIN=previous;}
});
