import {test,expect,type Page} from '@playwright/test';
import {execFileSync} from 'node:child_process';

/** Lab v3: direct manipulation in the 3D scene, the part popover, and the AI builder with its assembly animation. */
const PUBLIC='http://iot.admin.localhost:8891';
const SHOTS='test-results/lab-v3';

/** Page-coordinate position of a part, via the dev hook (?e2e=1). */
async function partAt(page:Page,id:string){
 const p=await page.evaluate(t=>{
  const sc=(window as unknown as {__labScene?:{project(t:string):{x:number;y:number;visible:boolean}|null}}).__labScene;
  const r=document.querySelector('canvas.lab-canvas')!.getBoundingClientRect();
  const q=sc?.project(t);
  return q?{x:r.left+q.x,y:r.top+q.y,visible:q.visible}:null;
 },id);
 expect(p,`part ${id} projected`).not.toBeNull();
 return p!;
}
async function openLab(page:Page,lesson:string){
 await page.goto(`${PUBLIC}/lab/${lesson}?e2e=1`);
 await expect(page.locator('.lab')).toHaveAttribute('data-scene','ready',{timeout:30000});
 await page.waitForTimeout(1200); // let the camera fit settle
}
const dockNumber=async(page:Page,id:string)=>Number(/(\d+)(?:\s*cm)?\s*$/.exec(await page.getByTestId(`lab-control-${id}`).locator('output').innerText())![1]);

async function dragBy(page:Page,from:{x:number;y:number},dx:number,dy:number){
 await page.mouse.move(from.x,from.y);
 await page.mouse.down();
 for(let i=1;i<=10;i++)await page.mouse.move(from.x+dx*i/10,from.y+dy*i/10);
 await page.mouse.up();
}

test('dragging the obstacle in 3D changes the distance the sensor reads',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await openLab(page,'distance');
 await page.getByTestId('lab-run').first().click();
 await expect(page.locator('.lab')).toHaveAttribute('data-sim-status','running');
 const before=await dockNumber(page,'obs1');
 const at=await partAt(page,'obs1');
 await page.mouse.move(at.x,at.y);
 await expect.poll(()=>page.locator('canvas.lab-canvas').evaluate(c=>(c as HTMLElement).style.cursor)).toBe('ns-resize');
 await dragBy(page,at,0,70);
 const after=await dockNumber(page,'obs1');
 expect(after).not.toBe(before);
 await expect(page.getByTestId('lab-serial')).toContainText(new RegExp(`\\b(${after-1}|${after}|${after+1}) cm`));
 await page.screenshot({path:`${SHOTS}/obstacle-dragged.png`,animations:'disabled'});
});

test('turning the knob in 3D changes A0',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await openLab(page,'knob');
 await page.getByTestId('lab-run').first().click();
 const before=await dockNumber(page,'pot1');
 const at=await partAt(page,'pot1');
 await page.mouse.move(at.x,at.y);
 await page.mouse.down();
 await page.mouse.move(at.x+30,at.y-30,{steps:4});
 await page.mouse.move(at.x+55,at.y+5,{steps:6});
 await page.screenshot({path:`${SHOTS}/knob-dragging.png`,animations:'disabled'});
 await page.mouse.up();
 const after=await dockNumber(page,'pot1');
 expect(after).not.toBe(before);
 await expect(page.getByTestId('lab-serial')).toContainText(String(after));
});

test('clicking the obstacle opens the popover: type chips and distance work, Zoom to it is there',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await openLab(page,'distance');
 const at=await partAt(page,'obs1');
 await page.mouse.click(at.x,at.y);
 const pop=page.getByTestId('lab-popover-obs1');
 await expect(pop).toBeVisible();
 for(const shape of ['box','ball','wall','car']){
  await pop.getByTestId(`lab-pop-shape-${shape}`).click();
  await expect(pop.getByTestId(`lab-pop-shape-${shape}`)).toHaveAttribute('aria-pressed','true');
 }
 await expect(pop.getByTestId('lab-pop-focus')).toBeVisible();
 await pop.locator('input[type=range]').evaluate((el:HTMLInputElement)=>{
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(el,'25');el.dispatchEvent(new Event('input',{bubbles:true}));
 });
 expect(await dockNumber(page,'obs1')).toBe(25);
 await page.screenshot({path:`${SHOTS}/parking-popover.png`,animations:'disabled'});
 await page.keyboard.press('Escape');
 await expect(pop).toHaveCount(0);
});

test('anonymous: the Parking beeper example assembles step by step, then runs for real',async({page})=>{
 test.setTimeout(150000);
 await page.setViewportSize({width:1440,height:900});
 await openLab(page,'blink');
 await page.getByTestId('lab-ai-open').click();
 await expect(page.getByTestId('lab-ai')).toBeVisible();
 await page.screenshot({path:`${SHOTS}/ai-builder-prompt.png`,animations:'disabled'});
 await page.getByTestId('lab-ai-ex-close-alarm').click();
 const captions=new Set<string>();
 let shot=false;
 await expect.poll(async()=>{
  const c=(await page.getByTestId('lab-ai-caption').textContent().catch(()=>''))?.trim();
  if(c)captions.add(c);
  if(!shot&&captions.size>=4){shot=true;await page.screenshot({path:`${SHOTS}/assembly-mid-step.png`,animations:'disabled'});}
  return await page.getByTestId('lab-ai').getAttribute('data-stage');
 },{timeout:120000,intervals:[300]}).toBe('ready');
 expect(captions.size,'the caption advanced through several steps').toBeGreaterThanOrEqual(3);
 await expect(page.getByTestId('lab-ai-chip').first()).toContainText('Generated by AI');
 await page.getByTestId('lab-run').click();
 await expect(page.locator('.lab')).toHaveAttribute('data-sim-status','running');
 await expect(page.getByTestId('lab-serial')).toContainText(/\d+ cm/,{timeout:20000});
 await expect(page.getByTestId('lab-code')).toContainText('NEAR_CM');
 await page.waitForTimeout(800);
 await page.screenshot({path:`${SHOTS}/assembled-running.png`,animations:'disabled'});
 // closing the builder gives the lesson back
 await page.getByTestId('lab-ai').getByRole('button',{name:'Close'}).click();
 await expect(page.getByTestId('lab-ai')).toHaveCount(0);
 await expect(page.getByTestId('lab-code')).toHaveAttribute('data-sketch',/blink/);
});

test('anonymous: free typing asks to sign in',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await openLab(page,'blink');
 await page.getByTestId('lab-ai-open').click();
 await page.getByTestId('lab-ai-prompt').fill('I want an Arduino that blinks twice when it gets dark');
 await page.getByTestId('lab-ai-submit').click();
 await expect(page.getByTestId('lab-ai-signin')).toContainText('Sign in to build your own');
});

test('mobile: the AI builder fits the screen',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await openLab(page,'blink');
 await page.getByTestId('lab-ai-open').click();
 const box=page.getByTestId('lab-ai');
 await box.scrollIntoViewIfNeeded();
 await expect(box).toBeVisible();
 const b=(await box.boundingBox())!;
 expect(b.x).toBeGreaterThanOrEqual(0);
 expect(b.x+b.width).toBeLessThanOrEqual(391);
 await page.screenshot({path:`${SHOTS}/ai-builder-mobile.png`,animations:'disabled'});
});

const compilerReady=():boolean=>{
 try{execFileSync('docker',['image','inspect',process.env.OPS_LAB_IMAGE||'aiot-avr-sandbox:1.8.8'],{stdio:'ignore',timeout:8000});return true;}catch{return false;}
};

test('member with lab-ai: prompt -> spec -> compile -> assembly -> run (fixture provider)',async({page,request})=>{
 test.skip(!compilerReady(),'docker and the aiot-avr-sandbox:1.8.8 image are not available, so the compile step cannot run (see scripts/lab-firmware/Dockerfile.sandbox)');
 test.setTimeout(180000);
 await page.setViewportSize({width:1440,height:900});
 const {token}=await (await request.get('/api/session')).json();
 const made=await (await request.fetch('/api/ops/members',{method:'POST',headers:{'X-IOT-Session':token},data:{username:`e2e.labai.${Date.now()}`,name:'Lia Lab',grants:['lab-ai']}})).json();
 await page.goto(PUBLIC+'/masuk');
 await page.getByRole('tab',{name:'Activate invite'}).click();
 await page.fill('#ml-code',made.inviteCode);
 await page.fill('#ml-password','a long member password');
 await page.fill('#ml-confirm','a long member password');
 await page.locator('form').getByRole('button',{name:'Activate and sign in'}).click();
 await expect(page).toHaveURL(PUBLIC+'/profile');
 await openLab(page,'blink');
 await page.getByTestId('lab-ai-open').click();
 await page.getByTestId('lab-ai-prompt').fill('I want an Arduino that beeps and lights red when something is closer than 20 cm');
 await page.getByTestId('lab-ai-submit').click();
 await expect(page.getByTestId('lab-ai')).toHaveAttribute('data-stage','assembling',{timeout:60000});
 await expect(page.getByTestId('lab-ai')).toHaveAttribute('data-stage','ready',{timeout:120000});
 await page.getByTestId('lab-run').click();
 await expect(page.locator('.lab')).toHaveAttribute('data-sim-status','running');
 await expect(page.getByTestId('lab-serial')).toContainText(/\d+ cm/,{timeout:20000});
});

test('/api stays 403 on the public alias',async({request})=>{
 expect((await request.get(PUBLIC+'/api/status')).status()).toBe(403);
 expect((await request.get(PUBLIC+'/api/session')).status()).toBe(403);
});
