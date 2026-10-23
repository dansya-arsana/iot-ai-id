import {test,expect,type Page} from '@playwright/test';
import {grantLab} from './lab-access';

const PORT='/dev/cu.usbmodem1101';
const apiPort=(base:string|undefined)=>new URL(base??'http://127.0.0.1:8891').port;

/** Stand-in for the USB bridge: stateful, no real hardware. */
async function mockBridge(page:Page,state:{boards:boolean;toolchain:boolean;period:number;trusted:boolean;uploads:number;uploadError?:string}){
 await page.route('**/api/lab/hardware/**',async route=>{
  const url=new URL(route.request().url());const path=url.pathname.replace('/api/lab/hardware','');
  const reply=(status:number,data:unknown)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  if(path==='/detect')return reply(200,{toolchain:state.toolchain,boards:state.boards?[{port:PORT,label:'Arduino Uno',vid:'2341',pid:'0043',clone:false}]:[],trusted:state.trusted?{[PORT]:new Date(Date.now()+1200000).toISOString()}:{}});
  if(path==='/trust'){state.trusted=true;return reply(200,{trusted:true,port:PORT,expiresAt:new Date(Date.now()+1200000).toISOString()});}
  if(path==='/upload'){
   if(!state.trusted)return reply(403,{error:'Authorize this port before uploading',code:'not_trusted'});
   if(state.uploadError)return reply(502,{error:state.uploadError,code:'upload_failed'});
   state.uploads++;return reply(200,{uploaded:true,port:PORT,bytes:1000,sha256:'0'.repeat(64)});
  }
  if(path==='/serial/start'||path==='/serial/stop')return reply(200,{started:true});
  if(path==='/serial'){
   const lines=[{n:1,t:0,text:'ready'},...Array.from({length:12},(_,i)=>({n:i+2,t:300+i*state.period,text:i%2?'D8 LOW':'D8 HIGH'}))];
   const since=Number(url.searchParams.get('since')??0);
   return reply(200,{open:true,lines:lines.filter(l=>l.n>since)});
  }
  return reply(404,{error:'Not found'});
 });
}
const fresh=()=>({boards:true,toolchain:true,period:500,trusted:false,uploads:0} as {boards:boolean;toolchain:boolean;period:number;trusted:boolean;uploads:number;uploadError?:string});

test('desktop flow: detect, authorize, upload, serial, match',async({page,baseURL})=>{
 const state=fresh();await mockBridge(page,state);
 await page.goto(`${baseURL}/lab/blink`);
 await page.getByTestId('lab-run').first().click();
 await expect(page.getByTestId('hw-detected')).toContainText(PORT);
 await expect(page.getByTestId('hw-upload')).toBeDisabled();
 await page.getByTestId('hw-authorize').click();
 await expect(page.getByTestId('hw-trusted')).toBeVisible();
 await page.getByTestId('hw-upload').click();
 await expect(page.getByTestId('hw-uploaded')).toBeVisible();
 expect(state.uploads).toBe(1);
 await expect(page.getByTestId('hw-real-log')).toContainText('D8 HIGH');
 await expect(page.getByTestId('hw-match')).toHaveAttribute('data-state','same',{timeout:30000});
 await expect(page.getByTestId('hw-match')).toContainText(/behaves the same/i);
});

test('a board that blinks at a different rate is reported as differing, with the pin',async({page,baseURL})=>{
 const state=fresh();state.period=1100;state.trusted=true;await mockBridge(page,state);
 await page.goto(`${baseURL}/lab/blink`);
 await page.getByTestId('lab-run').first().click();
 await page.getByTestId('hw-upload').click();
 await expect(page.getByTestId('hw-match')).toHaveAttribute('data-state','differs',{timeout:30000});
 await expect(page.getByTestId('hw-match')).toContainText('D8');
});

test('upload failure, missing toolchain and no board show friendly messages',async({page,baseURL})=>{
 const state=fresh();state.trusted=true;state.uploadError='avrdude: stk500_recv(): programmer is not responding';await mockBridge(page,state);
 await page.goto(`${baseURL}/lab/blink`);
 await page.getByTestId('hw-upload').click();
 await expect(page.getByTestId('hw-error')).toContainText('Upload failed');
 await expect(page.getByTestId('hw-error')).not.toContainText('avrdude');
 state.toolchain=false;state.boards=false;
 await expect(page.getByTestId('hw-error')).toContainText(/toolchain/i,{timeout:10000});
});

test('the public host shows only the desktop-app note and cannot reach the hardware API',async({page,baseURL})=>{
 const port=apiPort(baseURL);
 await grantLab(page,`http://iot.admin.localhost:${port}`);
 await page.goto(`http://iot.admin.localhost:${port}/lab/blink`);
 await expect(page.getByTestId('hw-public')).toContainText(/desktop app/i);
 await expect(page.getByTestId('hw-panel')).toHaveCount(0);
 const res=await page.request.get(`http://iot.admin.localhost:${port}/api/lab/hardware/detect`);
 expect(res.status()).toBe(403);
});

test('trust sends the native consent token when the desktop bridge exists, none in a plain browser',async({page,baseURL})=>{
 const bodies:string[]=[];
 await page.addInitScript(()=>{if(new URLSearchParams(location.search).has('desk'))(window as unknown as {aiotDesktop:unknown}).aiotDesktop={requestConsent:async()=>'v1.p.sig'};});
 const state=fresh();await mockBridge(page,state);
 page.on('request',r=>{if(r.url().endsWith('/api/lab/hardware/trust'))bodies.push(r.postData()??'');});
 await page.goto(`${baseURL}/lab/blink`);await page.getByTestId('lab-run').first().click();
 await page.getByTestId('hw-authorize').click();await expect(page.getByTestId('hw-trusted')).toBeVisible();
 expect(JSON.parse(bodies[0]).consent).toBeUndefined();
 const state2=fresh();await mockBridge(page,state2);
 await page.goto(`${baseURL}/lab/blink?desk=1`);await page.getByTestId('lab-run').first().click();
 await page.getByTestId('hw-authorize').click();await expect(page.getByTestId('hw-trusted')).toBeVisible();
 expect(JSON.parse(bodies[1]).consent).toBe('v1.p.sig');
});
