import {test,expect,type Page} from '@playwright/test';

const PUBLIC='http://iot.admin.localhost:8891';
/** Set a range input the way a user drag would: native value setter plus input event. */
async function setRange(page:Page,testid:string,value:number){
 await page.getByTestId(testid).evaluate((el,v)=>{
  const input=(el instanceof HTMLInputElement?el:el.querySelector('input')) as HTMLInputElement;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,String(v));
  input.dispatchEvent(new Event('input',{bubbles:true}));
 },value);
}
async function run(page:Page,lesson:string){
 await page.goto(`${PUBLIC}/lab/${lesson}`);
 await expect(page.locator('.lab')).toBeVisible();
 await page.getByTestId('lab-run').first().click();
 await expect(page.locator('.lab')).toHaveAttribute('data-sim-status','running');
 await page.getByRole('tab',{name:/pinout/i}).click();
}
const level=(page:Page,pin:string)=>page.locator(`[data-pin="${pin}"]`).first().getAttribute('data-level');

test('lab is public: lesson cards and progress',async({page})=>{
 await page.goto(`${PUBLIC}/lab`);
 await expect(page.locator('.lab')).toBeVisible();
 await expect(page.getByText('Invitation-only')).toHaveCount(0);
 await expect(page.locator('[data-testid^="lab-lesson-"]')).toHaveCount(12);
 await expect(page.getByTestId('lab-progress')).toContainText('/12');
});

test('blink runs on the emulated UNO and a param edit reaches the firmware',async({page})=>{
 await run(page,'blink');
 const seen=new Set<string|null>();
 await expect.poll(async()=>{seen.add(await level(page,'D8'));return seen.has('0')&&seen.has('1');},{timeout:5000}).toBe(true);
 await expect(page.getByTestId('lab-serial')).toContainText('Reset ATmega328P');
 await expect(page.getByTestId('lab-serial')).toContainText('D8 HIGH');
 await page.locator('button[data-param="onTime"]').first().click();
 await setRange(page,'lab-param-onTime',250);
 await expect(page.getByTestId('lab-code')).toContainText('onTime = 250');
 await expect(page.getByTestId('lab-serial')).toContainText('Wrote onTime = 250');
});

test('button hold drives D8',async({page})=>{
 await run(page,'button');
 const btn=page.getByTestId('lab-control-btn1');
 const box=(await btn.boundingBox())!;
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
 await page.mouse.down();
 await expect.poll(()=>level(page,'D8')).toBe('1');
 await page.mouse.up();
 await expect.poll(()=>level(page,'D8')).toBe('0');
});

test('knob at max prints 1023',async({page})=>{
 await run(page,'knob');
 await setRange(page,'lab-control-pot1',1023);
 await expect(page.getByTestId('lab-serial')).toContainText('1023');
});

test('distance sensor reads the obstacle',async({page})=>{
 await run(page,'distance');
 await setRange(page,'lab-control-obs1',40);
 await expect(page.getByTestId('lab-serial')).toContainText(/\b(39|40|41) cm/);
});

test('Indonesian lab',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('iot-lang','id'));
 await page.goto(`${PUBLIC}/lab`);
 await expect(page.getByText('Kenalan dengan UNO').first()).toBeVisible();
});

test('unknown lesson redirects to /lab',async({page})=>{
 await page.goto(`${PUBLIC}/lab/nope`);
 await expect(page).toHaveURL(/\/lab\/?$/);
});

test('main chunk has no three.js or avr8js',async({request})=>{
 const html=await (await request.get(`${PUBLIC}/`)).text();
 const src=[...html.matchAll(/src="([^"]*assets\/index-[^"]+\.js)"/g)].map(m=>m[1]);
 expect(src.length).toBeGreaterThan(0);
 for(const s of src){
  const js=await (await request.get(new URL(s,PUBLIC).toString())).text();
  expect(js).not.toContain('WebGLRenderer');
  expect(js).not.toContain('avrInstruction');
 }
});
