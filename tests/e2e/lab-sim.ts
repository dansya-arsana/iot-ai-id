import {expect,type Page} from '@playwright/test';

/**
 * Waits for the lab e2e specs, measured in SIMULATED time. The emulated chip runs at whatever speed the machine manages (a loaded CI box may
 * give 0.2x real time), so "within 30 s of wall clock" is the wrong question. The right one is "within N simulated ms": firmware needs the same
 * simulated time everywhere. Every poll reads `window.__snap` (the spec wraps `__labScene.update` to keep it), and the budget runs out when the
 * snapshot's `simTimeMs` has advanced by the budget, never earlier. A wall-clock cap only guards against a sim that stopped advancing.
 */
type SnapW=Window&{__snap?:{simTimeMs?:number;status?:string}};

/** Wall-clock cap for a sim that is not advancing at all (stopped, crashed, tab hidden). */
export const STALL_MS=60000;
/** A spec's own timeout: generous, because slow machines stretch wall time, but the sim budgets decide pass or fail. */
export const SLOW_TEST_MS=420000;

export const simNow=(page:Page):Promise<number>=>page.evaluate(()=>(window as SnapW).__snap?.simTimeMs??0);

/** Let `ms` of simulated time pass (the sim must be running). */
export async function waitSim(page:Page,ms:number):Promise<void>{
 const t0=await simNow(page);
 await untilSim(page,`${ms} sim ms to pass`,()=>simNow(page),t=>t-t0>=ms,ms+2000);
}

/**
 * Poll `read` until `pred` holds. Fails when `budgetSimMs` of simulated time went by without it (reporting the last value), or when the
 * simulation made no progress for STALL_MS of wall clock.
 */
export async function untilSim<T>(page:Page,what:string,read:()=>Promise<T>,pred:(v:T)=>boolean,budgetSimMs=30000):Promise<T>{
 const t0=await simNow(page);
 let lastT=t0,lastMove=Date.now(),last:T|undefined;
 for(;;){
  last=await read();
  if(pred(last))return last;
  const t=await simNow(page);
  if(t>lastT){lastT=t;lastMove=Date.now();}
  if(t-t0>budgetSimMs)throw new Error(`${what}: not true after ${budgetSimMs} simulated ms (last: ${JSON.stringify(last)})`);
  if(Date.now()-lastMove>STALL_MS)throw new Error(`${what}: the simulation stopped advancing (sim t=${t.toFixed(0)} ms, last: ${JSON.stringify(last)})`);
  await page.waitForTimeout(120);
 }
}

/** Serial monitor text contains `pattern` within the budget. */
export async function serialHas(page:Page,pattern:string|RegExp,budgetSimMs=15000):Promise<void>{
 await untilSim(page,`serial output ${pattern}`,()=>page.getByTestId('lab-serial').innerText(),t=>typeof pattern==='string'?t.includes(pattern):pattern.test(t),budgetSimMs);
}

/** The lesson goal row flips to done within the budget. */
export async function goalDone(page:Page,budgetSimMs=15000,done=true):Promise<void>{
 await untilSim(page,`goal data-done=${done}`,()=>page.getByTestId('lab-goal').first().getAttribute('data-done'),v=>v===String(done),budgetSimMs);
}

/** Wrap `__labScene.update` so every frame leaves its snapshot in `window.__snap`. */
export async function hookSnapshot(page:Page):Promise<void>{
 await page.evaluate(()=>{
  const sc=(window as unknown as {__labScene:{update(s:unknown,d:number):void}}).__labScene;
  const orig=sc.update.bind(sc);
  sc.update=(s,d)=>{(window as SnapW).__snap=s as SnapW['__snap'];orig(s,d);};
 });
 await expect.poll(()=>page.evaluate(()=>!!(window as SnapW).__snap),{timeout:15000}).toBe(true);
}
