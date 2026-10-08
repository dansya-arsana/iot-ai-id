import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const {backendEnvironment,stopBackend}=createRequire(import.meta.url)('../apps/desktop/lifecycle.cjs');
test('desktop isolates writable state and retains Finder tool paths',()=>{
 const env=backendEnvironment('/App/Resources','/Users/test/Application Support/IOT AI ID',{PATH:'/usr/bin',HOME:'/Users/test'});
 assert.equal(env.API_BIND,'127.0.0.1');assert.equal(env.API_PORT,'8788');
 assert.equal(env.IOT_DB_PATH,'/Users/test/Application Support/IOT AI ID/iot.sqlite');
 assert.equal(env.IOT_RUNTIME_BUILDS_PATH,'/Users/test/Application Support/IOT AI ID/runtime/builds');
 assert.equal(env.ARDUINO_CLI_PATH,'/App/Resources/bin/arduino-cli');assert.match(env.PATH,/\/opt\/homebrew\/bin/);
 assert.equal(env.HOME,'/Users/test');
});
test('shutdown stops backend and its detached runtime group',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'iot-desktop-stop-'));const pidFile=join(dir,'child.pid');
 const script=`import {execute,terminateActiveProcesses} from './services/orchestrator/process.ts';process.on('SIGTERM',()=>{terminateActiveProcesses();process.exit(0)});void execute(process.execPath,['-e','require("node:fs").writeFileSync(process.argv[1],String(process.pid));setInterval(()=>{},1000)',process.argv[1]],'',60000);setInterval(()=>{},1000);`;
 const parent=spawn(process.execPath,['--import','tsx','--input-type=module','-e',script,pidFile],{detached:true,stdio:'ignore'});
 try{let pid=0;for(let attempt=0;attempt<100;attempt++){try{pid=Number(await readFile(pidFile,'utf8'));if(pid)break;}catch{/* Not ready. */}await new Promise(resolve=>setTimeout(resolve,20));}
 assert.ok(pid,'runtime child started');await stopBackend(parent);
 assert.throws(()=>process.kill(pid,0),/ESRCH/);
 }finally{if(parent.exitCode===null)try{process.kill(-parent.pid!,'SIGKILL');}catch{/* Exited. */}await rm(dir,{recursive:true,force:true});}
});
