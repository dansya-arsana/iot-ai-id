import {spawn,type ChildProcess} from 'node:child_process';
const activeChildren=new Set<ChildProcess>();
/** Detached runtime groups must be stopped before the API process exits. */
export function terminateActiveProcesses(){for(const child of activeChildren){try{if(process.platform!=='win32'&&child.pid)process.kill(-child.pid,'SIGKILL');else child.kill('SIGKILL');}catch{/* Child already exited. */}}}
process.once('exit',terminateActiveProcesses);
/** Execute fixed argv. Timeout terminates the process group, including compiler/upload descendants. */
export function execute(command:string,args:string[],input:string,timeout=60000,cwd?:string):Promise<string>{return new Promise((resolve,reject)=>{
 let out='',err='',failure:Error|undefined,killTimer:ReturnType<typeof setTimeout>|undefined;
 const child=spawn(command,args,{cwd,stdio:['pipe','pipe','pipe'],shell:false,detached:process.platform!=='win32'});
 activeChildren.add(child);
 function kill(signal:NodeJS.Signals){try{if(process.platform!=='win32'&&child.pid)process.kill(-child.pid,signal);else child.kill(signal);}catch{/* Process already terminated. */}}
 function stop(error:Error){if(failure)return;failure=error;kill('SIGTERM');killTimer=setTimeout(()=>kill('SIGKILL'),2000);}
 const timer=setTimeout(()=>stop(new Error('Provider timed out')),timeout);
 child.stdout.on('data',chunk=>{out+=chunk;if(out.length>2000000)stop(new Error('Provider output exceeded limit'));});
 child.stderr.on('data',chunk=>{err=(err+chunk).slice(-4000);});
 child.on('error',error=>{failure=error;});
 child.on('close',code=>{activeChildren.delete(child);kill('SIGKILL');clearTimeout(timer);if(killTimer)clearTimeout(killTimer);if(failure)reject(failure);else if(code!==0)reject(new Error(`Provider exited ${code}: ${err.replace(/(?:Bearer\s+|sk-)[\w.-]+/g,'[redacted]').slice(-500)}`));else resolve(out);});
 child.stdin.on('error',()=>{});child.stdin.end(input);
});}
