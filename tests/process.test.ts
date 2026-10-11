import test from 'node:test';
import assert from 'node:assert/strict';
import {execute} from '../services/orchestrator/process.js';
test('timeout waits for termination even when executor ignores SIGTERM',async()=>{const started=Date.now();await assert.rejects(execute(process.execPath,['-e',"process.on('SIGTERM',()=>{});setInterval(()=>{},1000)"],'',200),/timed out/);assert.ok(Date.now()-started>=2100);});
test('fixed argv does not expand shell tokens and handles spawn failure',async()=>{assert.equal(await execute(process.execPath,['-e','process.stdout.write(process.argv[1])','$(echo unexpected)'],'',1000),'$(echo unexpected)');await assert.rejects(execute('/nonexistent/iot-executor',[],'',1000),/ENOENT/);});

test('provider preflight names the missing AI provider explicitly',async()=>{
 const saved={...process.env};
 process.env.CODEX_BIN='/missing-iot-test/codex';process.env.CLAUDE_BIN='/missing-iot-test/claude';delete process.env.OPENAI_API_KEY;
 const {JevProvider}=await import('../services/orchestrator/provider.js');
 try{await assert.rejects(new JevProvider(()=>({}),()=>({models:{}}),'local').preflight(),/No AI provider configured/);}finally{process.env=saved;}
});
