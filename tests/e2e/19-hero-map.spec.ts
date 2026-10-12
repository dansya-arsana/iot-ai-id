import {test,expect,type Page} from '@playwright/test';

const PUBLIC='http://iot.admin.localhost:8891';
const hero=(page:Page)=>page.getByTestId('hero-map');
async function open(page:Page,url='/'){await page.goto(url);await expect(page.locator('.result-landing')).toHaveAttribute('data-ready','true');await expect(page.locator('.rl-loader')).toBeHidden();}
/** Screen position of one of a region's dots, read from its path and the live SVG transform (so it is right while zoomed). */
async function regionPoint(page:Page,id:string,n=30){return page.evaluate(([rid,i])=>{const g=document.querySelector(`.hm-g[data-region="${rid}"] path`) as SVGPathElement,all=[...g.getAttribute('d')!.matchAll(/M([\d.]+) ([\d.]+)h0/g)],svg=g.ownerSVGElement!,ctm=svg.getScreenCTM()!;
  for(let k=0;k<all.length;k++){const m=all[((i as number)+k)%all.length],pt=svg.createSVGPoint();pt.x=+m[1];pt.y=+m[2];const s=pt.matrixTransform(ctm);if(document.elementFromPoint(s.x,s.y)?.closest('.hm-map'))return{x:s.x,y:s.y};} // skip dots hidden under the card
  throw new Error('no free dot');},[id,n] as [string,number]);}
/** The two ends of a region's widest row of dots (for a hover sweep along the land). */
async function regionRow(page:Page,id:string){return page.evaluate(rid=>{const g=document.querySelector(`.hm-g[data-region="${rid}"] path`) as SVGPathElement,svg=g.ownerSVGElement!,ctm=svg.getScreenCTM()!,rows=new Map<number,number[]>();
  for(const m of g.getAttribute('d')!.matchAll(/M([\d.]+) ([\d.]+)h0/g)){const y=+m[2];(rows.get(y)??rows.set(y,[]).get(y)!).push(+m[1]);}
  const[y,xs]=[...rows.entries()].sort((a,b)=>b[1].length-a[1].length)[0],at=(x:number)=>{const pt=svg.createSVGPoint();pt.x=x;pt.y=y;const s=pt.matrixTransform(ctm);return{x:s.x,y:s.y};};
  return{a:at(Math.min(...xs)),b:at(Math.max(...xs))};},id);}
/** Clicks a region's dot with the real mouse (dots are tiny; the map resolves the nearest region). */
async function clickRegion(page:Page,id:string){await settled(page);const p=await regionPoint(page,id);await page.mouse.click(p.x,p.y);}
const panel=(page:Page)=>page.getByTestId('hero-panel');
/** Lens controls live in popovers: open the trigger, then press the option (which closes the popover). */
async function lens(page:Page,trigger:'I build'|'Stressor'|'Month',option:string){await page.getByRole('button',{name:new RegExp(`^${trigger}:`)}).click();await page.getByRole('group',{name:trigger}).getByRole('button',{name:option,exact:true}).click();}
const settled=(page:Page)=>expect(page.locator('.hm-stage')).not.toHaveAttribute('data-zooming','');

test('hero fills the viewport, leads with the headline and shows the proof line',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await open(page);
 const box=(await hero(page).boundingBox())!;expect(Math.round(box.height)).toBe(900);
 await expect(page.getByRole('heading',{level:1})).toHaveText('Prove your robot where it actually breaks.');
 await expect(page.locator('.rl-eyebrow').first()).toHaveText('The real-world gateway for AI robotics in Indonesia');
 await expect(hero(page)).toContainText('National mean air temperature 27.5 °C in 2024 (BMKG)');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await expect(page.locator('.hm-g path').first()).toBeAttached();
 expect(await page.locator('.hm-g[data-region="java"] path').first().evaluate(el=>el.parentElement!.getAttribute('data-region'))).toBe('java');
 expect(await page.locator('.hm-map *').count()).toBeLessThanOrEqual(30);
 await page.screenshot({path:'test-results/hero-map-desktop.png',animations:'disabled'});
});

test('picking a robot type brightens the regions that fit; the sea and neighbours stay',async({page})=>{
 await open(page);
 await lens(page,'I build','Drone');
 await expect(page.getByRole('button',{name:'I build: Drone'})).toBeVisible();
 await expect(page.locator('.hm-g[data-region="java"]')).toHaveAttribute('data-s','lit');
 await expect(page.locator('.hm-g[data-region="sulawesi"]')).toHaveAttribute('data-s','dim');
 await lens(page,'I build','Marine');
 await expect(page.locator('.hm-g[data-region="sulawesi"]')).toHaveAttribute('data-s','lit');
 await lens(page,'Stressor','Heat & humidity');
 await expect(page.locator('.hm-g[data-region="sulawesi"]')).toHaveAttribute('data-s','lit');
 await expect(page.locator('.hm-g[data-region="maluku"]')).toHaveAttribute('data-s','dim');
 await page.getByRole('button',{name:'Clear'}).click();
 await expect(page.locator('.hm-g[data-region="maluku"]')).toHaveAttribute('data-s','base');
 await expect(page.getByRole('button',{name:/^I build:/})).toContainText('Any');
});

test('clicking a region opens a panel with at most three sourced facts, tests and a CTA; keyboard Enter and Esc work',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await open(page);
 await clickRegion(page,'sumatra');
 await expect(panel(page).getByRole('heading',{name:'Sumatra'})).toBeVisible();
 const tiles=panel(page).locator('.hm-stat');expect(await tiles.count()).toBeLessThanOrEqual(3);
 for(const t of await tiles.all())await expect(t.locator('sup button')).toContainText(/\d{4}/);
 await expect(panel(page)).toContainText('19.06%');
 await expect(page.getByTestId('schools-line')).toContainText(/potential reach, not partners/);
 await settled(page);
 await expect(panel(page).getByRole('link',{name:/Get a test plan · Sumatra/})).toBeVisible();
 await page.screenshot({path:'test-results/hero-map-region-desktop.png',animations:'disabled'});
 await page.keyboard.press('Escape');
 await expect(panel(page).getByRole('heading',{name:'Where would it break?'})).toBeVisible();
 await page.locator('.hm-g[data-region="java"]').focus();await page.keyboard.press('Enter');
 await expect(panel(page).getByRole('heading',{name:'Java'})).toBeFocused();
 await expect(page.locator('.hm-stage')).toHaveAttribute('data-zoom','java');
 await page.keyboard.press('Escape');
 await expect(panel(page).getByRole('heading',{name:'Where would it break?'})).toBeVisible();
 await expect(page.locator('.hm-g[data-region="java"]')).toBeFocused();
 await expect(page.locator('.hm-stage')).not.toHaveAttribute('data-zoom','java');
 // the sea is its own region
 await page.locator('g[data-region="maritime"]').focus();await page.keyboard.press('Enter');
 await expect(panel(page).getByRole('heading',{name:'Maritime Indonesia'})).toBeVisible();
 // a tile's source tag opens the drawer scrolled to that fact
 await page.keyboard.press('Escape');await clickRegion(page,'sumatra');
 await panel(page).locator('.hm-stat sup button').first().click();
 await expect(page.getByRole('dialog',{name:/Sources & confidence/})).toBeVisible();await expect(page.locator('#fact-sumatra-0')).toBeInViewport();
 await page.keyboard.press('Escape');
 await page.locator('g[data-region="maritime"]').focus();await page.keyboard.press('Enter');
 // the Sources drawer lists every fact with confidence badges, low ones included
 await panel(page).getByRole('button',{name:'Sources',exact:true}).click();
 const drawer=page.getByRole('dialog',{name:/Sources & confidence/});await expect(drawer).toBeVisible();
 await expect(drawer.locator('.hm-conf[data-conf="L"]').first()).toBeVisible();
 await expect(drawer).toContainText('What we don\'t know yet');
 await page.keyboard.press('Escape');await expect(drawer).toBeHidden();
});

test('the month lens changes regional states and labels the pattern as typical',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await open(page);
 await lens(page,'Month','Aug');
 await expect(page.locator('.hm-g[data-region="sumatra"]')).toHaveAttribute('data-season','haze');
 await expect(page.locator('.hm-g[data-region="java"]')).toHaveAttribute('data-season','dry');
 await expect(page.locator('.hm-g[data-region="sulawesi"]')).toHaveAttribute('data-season','none');
 await expect(hero(page)).toContainText('typical pattern, BMKG; varies by zone and year');
 await page.screenshot({path:'test-results/hero-map-month-desktop.png',animations:'disabled'});
 await lens(page,'Month','Jul');
 await expect(page.locator('.hm-g[data-region="maluku"]')).toHaveAttribute('data-season','wet');
 for(let n=0;n<5;n++)await page.getByRole('button',{name:'Next month'}).click();
 await expect(page.getByRole('button',{name:'Month: Dec'})).toBeVisible();
 for(let n=0;n<2;n++)await page.getByRole('button',{name:'Next month'}).click();
 await expect(page.getByRole('button',{name:'Month: Jan'})).toBeVisible();
 await expect(page.locator('.hm-g[data-region="java"]')).toHaveAttribute('data-season','wet');
 await expect(page.locator('.hm-g[data-region="sumatra"]')).toHaveAttribute('data-season','wet');
});

test('Java shows its hotspots; a hotspot panel carries its site into the partner form and the stored inquiry',async({page,request})=>{
 await page.setViewportSize({width:1440,height:900});await open(page);
 await expect(page.locator('.hm-pin[data-pin="jakarta"]')).toBeVisible();
 await expect(page.locator('.hm-pin[data-pin="gresik-jiipe"]')).toHaveCount(0);
 await clickRegion(page,'java');
 await panel(page).getByRole('tab',{name:/Sites/}).click();
 await expect(panel(page).getByRole('tabpanel').getByRole('button',{name:/Bekasi/})).toContainText('PLANNED');
 expect(await page.locator('.hm-pin[data-kind]').count()).toBeGreaterThanOrEqual(9);
 await settled(page);await page.screenshot({path:'test-results/hero-map-java-hotspots-desktop.png',animations:'disabled'});
 await panel(page).getByRole('tabpanel').getByRole('button',{name:/Jakarta/}).click();
 await expect(panel(page).getByRole('heading',{name:'Jakarta'})).toBeVisible();await page.waitForTimeout(250);
 await page.screenshot({path:'test-results/hero-map-site-desktop.png',animations:'disabled'});
 await panel(page).getByRole('navigation',{name:'Breadcrumb'}).getByRole('button',{name:'Java'}).click();
 await panel(page).getByRole('tab',{name:/Sites/}).click();
 await lens(page,'I build','Drone');
 await panel(page).getByRole('tabpanel').getByRole('button',{name:/Kendal/}).click();
 await expect(panel(page).getByRole('heading',{name:'Semarang & KEK Kendal'})).toBeVisible();
 await expect(page.locator('.hm-pin[data-pin="semarang-kendal"]')).toHaveAttribute('data-on','');
 await expect(panel(page).getByRole('navigation',{name:'Breadcrumb'})).toContainText('Java');
 await panel(page).getByRole('tab',{name:'Why'}).click();
 await expect(panel(page)).toContainText('KEK Kendal');
 const cta=panel(page).getByRole('link',{name:/Get a test plan · Kendal/});
 await expect(cta).toHaveAttribute('href','/partner?region=java&build=drone&site=semarang-kendal');
 await cta.click();
 await expect(page).toHaveURL(/\/partner\?region=java&build=drone&site=semarang-kendal$/);
 await expect(page.getByTestId('test-context')).toContainText('Semarang & KEK Kendal');
 await page.fill('#pt-name','Context Tester');await page.fill('#pt-email','ctx@example.com');
 await page.fill('#pt-message','Testing the map context fields end to end.');await page.locator('.pt-consent input').check();
 await page.getByRole('button',{name:'Send inquiry'}).click();
 await expect(page.getByRole('heading',{name:'Thank you. We have your message.'})).toBeVisible();
 const {token}=await (await request.get('/api/session')).json();
 const list=await (await request.get('/api/ops/inquiries',{headers:{'X-IOT-Session':token}})).json();
 const mine=list.inquiries.find((i:{name:string})=>i.name==='Context Tester');
 expect(mine).toMatchObject({region:'java',build:'drone',site:'semarang-kendal'});
});

test('the CTA carries lens context to /partner, which shows a summary and ignores unknown values',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await open(page);
 await lens(page,'I build','Drone');await lens(page,'Month','Aug');await lens(page,'Stressor','Haze & dust');
 await clickRegion(page,'sumatra');
 await panel(page).getByRole('link',{name:/Get a test plan · Sumatra/}).click();
 await expect(page).toHaveURL(/\/partner\?region=sumatra&build=drone&month=aug&stressor=haze$/);
 const ctx=page.getByTestId('test-context');
 await expect(ctx).toContainText('Sumatra');await expect(ctx).toContainText('Drone');await expect(ctx).toContainText('Aug');await expect(ctx).toContainText('Haze & dust');
 await page.evaluate(()=>window.scrollTo(0,0));await ctx.scrollIntoViewIfNeeded();
 await page.screenshot({path:'test-results/partner-context-desktop.png',animations:'disabled'});
 await page.goto('/partner?region=narnia&build=<script>&month=13&site=nowhere');
 await expect(page.getByTestId('test-context')).toHaveCount(0);
});


test('the scroll button lands on #gap without adding history',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await open(page);
 const before=await page.evaluate(()=>history.length);
 await page.getByRole('link',{name:/Scroll to the gap/}).click();
 await expect.poll(async()=>Math.abs((await page.locator('#gap').boundingBox())!.y)).toBeLessThan(40);
 expect(await page.evaluate(()=>history.length)).toBe(before);
});

test('one scroll at the top goes straight to section 2 when it starts away from the map and no card is open',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await open(page);await page.evaluate(()=>window.scrollTo(0,0));
 await page.mouse.move(300,170);await page.mouse.wheel(0,100); // over the headline, outside the map frame
 await expect.poll(async()=>Math.abs((await page.locator('#gap').boundingBox())!.y)).toBeLessThan(40);
 // one-shot: after the jump, scrolling back up is native and does not snap back
 await page.evaluate(()=>window.scrollTo(0,0));await page.mouse.wheel(0,100);
 await page.waitForTimeout(800);expect(await page.evaluate(()=>window.scrollY)).toBeLessThan(300);
});

test('a wheel that starts over the map frame or the card scrolls the page normally: no jump, never a zoom',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await open(page);await page.evaluate(()=>window.scrollTo(0,0));
 await page.mouse.move(600,600);await page.mouse.wheel(0,40); // over the map
 await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBeGreaterThan(0);
 await page.waitForTimeout(900);
 const y=await page.evaluate(()=>window.scrollY);console.log('wheel over map: scrollY',y);
 expect(y).toBeGreaterThanOrEqual(20);expect(y).toBeLessThan(120);
 await expect(page.locator('.hm-stage')).not.toHaveAttribute('data-zoom',/.+/);
 await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(100);
 await clickRegion(page,'java');await settled(page);
 const box=(await panel(page).boundingBox())!;await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.wheel(0,60);
 await page.waitForTimeout(800);expect(await page.evaluate(()=>window.scrollY)).toBeLessThan(120);
 await expect(page.locator('.hm-stage')).toHaveAttribute('data-zoom','java');
});

test('no scroll assist while a card is open, even when the wheel starts above the map',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await open(page);
 await clickRegion(page,'java');await settled(page);
 await page.mouse.move(300,170);await page.mouse.wheel(0,100);
 await page.waitForTimeout(800);expect(await page.evaluate(()=>window.scrollY)).toBeLessThan(120);
});

const SIZES=[{width:1440,height:900},{width:1280,height:720},{width:2000,height:1150}];
const TARGETS:[string,(page:Page)=>Promise<void>][]=[
 ['sumatra',p=>clickRegion(p,'sumatra')],
 ['java',p=>clickRegion(p,'java')],
 ['java > bekasi-karawang',async p=>{await clickRegion(p,'java');await settled(p);await p.locator('.hm-pin[data-pin="bekasi-karawang"]').click();}],
 ['maritime',async p=>{await p.locator('g[data-region="maritime"]').focus();await p.keyboard.press('Enter');}],
 ['papua',p=>clickRegion(p,'papua')],
];
for(const size of SIZES)test(`selecting never moves the page or resizes the hero, and the CTA stays visible at ${size.width}x${size.height}`,async({page})=>{
 await page.setViewportSize(size);await open(page);
 const geo=()=>page.evaluate(()=>{const r=(s:string)=>document.querySelector(s)!.getBoundingClientRect();const h=r('[data-testid=hero-map]'),st=r('.hm-stage'),a=r('[data-testid=hero-panel]');return{y:window.scrollY,hero:h.height,heroBottom:h.bottom,stageBottom:st.bottom,stageH:st.height,cardH:a.height,vh:window.innerHeight};});
 const base=await geo();
 for(const[name,go]of TARGETS){
  await go(page);await settled(page);
  const g=await geo(),cta=(await page.locator('[data-cta="hero-test-plan"]').boundingBox())!;
  const tag=`${name} @${size.width}x${size.height}`;
  expect(g.y,`scrollY ${tag}`).toBe(base.y);expect(Math.abs(g.hero-base.hero),`hero height ${tag}`).toBeLessThanOrEqual(1);
  expect(g.cardH,`card<=stage ${tag}`).toBeLessThanOrEqual(g.stageH);expect(g.stageBottom,`stage<=hero ${tag}`).toBeLessThanOrEqual(g.heroBottom+.5);
  expect(cta.y,`CTA top ${tag}`).toBeGreaterThanOrEqual(0);expect(cta.y+cta.height,`CTA bottom ${tag}`).toBeLessThanOrEqual(g.vh);
  console.log(`${tag}: scrollY ${g.y}, hero ${g.hero}, card ${Math.round(g.cardH)}/${Math.round(g.stageH)}, CTA bottom ${Math.round(cta.y+cta.height)}/${g.vh}`);
  await page.keyboard.press('Escape');
  if(name.includes('>')){await page.keyboard.press('Escape');}
  await expect(panel(page).getByRole('heading',{name:'Where would it break?'})).toBeVisible();await settled(page);
  const after=await geo();expect(after.y).toBe(base.y);expect(Math.abs(after.hero-base.hero)).toBeLessThanOrEqual(1);
 }
});

test('layout screenshots at 1280 and 2000 with Java selected',async({page})=>{
 for(const[w,h]of[[1280,720],[2000,1150]]){await page.setViewportSize({width:w,height:h});await open(page);await clickRegion(page,'java');await settled(page);await page.screenshot({path:`test-results/hero-map-${w}.png`,animations:'disabled'});}
});

test('layout shift over select, pin and close from scrollY=120 stays under 0.001',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await open(page);
 await page.evaluate(()=>{(window as unknown as {cls:number}).cls=0;new PerformanceObserver(l=>{for(const e of l.getEntries()){const s=e as unknown as {value:number;hadRecentInput:boolean};if(!s.hadRecentInput)(window as unknown as {cls:number}).cls+=s.value;}}).observe({type:'layout-shift',buffered:false});window.scrollTo(0,120);});
 await clickRegion(page,'java');await settled(page);await page.locator('.hm-pin[data-pin="jakarta"]').click();await page.waitForTimeout(300);await page.keyboard.press('Escape');await page.keyboard.press('Escape');await page.waitForTimeout(700);
 expect(await page.evaluate(()=>(window as unknown as {cls:number}).cls)).toBeLessThanOrEqual(.001);
});

test('selecting zooms the camera; reduced motion makes it instant, and Esc clears the zoom',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:1440,height:900});await open(page);
 await expect(page.locator('.hm-cam')).toHaveCSS('transition-duration','0s');
 await clickRegion(page,'java');
 await expect(page.locator('.hm-stage')).toHaveAttribute('data-zoom','java');
 await expect(page.locator('.hm-stage')).not.toHaveAttribute('data-zooming','');
 await page.keyboard.press('Escape');
 await expect(page.locator('.hm-stage')).not.toHaveAttribute('data-zoom',/.+/);
});

test('the card tabs follow the WAI-ARIA tabs keyboard pattern',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await open(page);
 await clickRegion(page,'java');await settled(page);
 const tabs=panel(page).getByRole('tab');await expect(tabs).toHaveCount(3);
 await tabs.first().focus();await page.keyboard.press('ArrowRight');
 await expect(panel(page).getByRole('tab',{name:/Sites/})).toHaveAttribute('aria-selected','true');
 const id=await panel(page).getByRole('tab',{name:/Sites/}).getAttribute('aria-controls');await expect(page.locator(`#${id}`)).toBeVisible();
 await page.keyboard.press('End');await expect(panel(page).getByRole('tab',{name:'Why'})).toHaveAttribute('aria-selected','true');
 await expect(panel(page).getByTestId('schools-full')).toContainText('Existing schools, not partners');
 await page.keyboard.press('Home');await expect(panel(page).getByRole('tab',{name:'Tests'})).toHaveAttribute('aria-selected','true');
 await page.keyboard.press('ArrowLeft');await expect(panel(page).getByRole('tab',{name:'Why'})).toHaveAttribute('aria-selected','true');
});

test('hit accuracy: at idle a pin position selects its region, after zooming every Java pin opens its own card',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await open(page);
 for(const id of['jakarta','surabaya-perak','semarang-kendal']){
  await page.goto('/');await expect(page.locator('.result-landing')).toHaveAttribute('data-ready','true');await expect(page.locator('.rl-loader')).toBeHidden();
  const b=(await page.locator(`.hm-pin[data-pin="${id}"]`).boundingBox())!;await page.mouse.click(b.x+b.width/2,b.y+b.height/2);
  await expect(panel(page).getByRole('heading',{name:'Java',exact:true})).toBeVisible();
 }
 await page.goto('/');await expect(page.locator('.rl-loader')).toBeHidden();
 await clickRegion(page,'java');await settled(page);
 const ids=await page.locator('.hm-pin[data-i]').evaluateAll(els=>els.map(e=>e.getAttribute('data-pin')!));
 expect(ids.length).toBe(9);let ok=0;
 for(const id of ids){
  const pin=page.locator(`.hm-pin[data-pin="${id}"]`),name=(await pin.getAttribute('aria-label'))!.replace(/( \(planned lab\))?: test conditions$/,'');
  const b=(await pin.boundingBox())!;await page.mouse.click(b.x+b.width/2,b.y+b.height/2);
  if(await panel(page).getByRole('heading',{level:2}).filter({hasText:name}).count()===1)ok++;else console.log('MISS',id,'->',await panel(page).getByRole('heading',{level:2}).innerText());
 }
 console.log(`java pin hit accuracy ${ok}/${ids.length}`);expect(ok).toBe(9);
});

test('after Java is selected no two labels overlap each other or the card',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await open(page);await clickRegion(page,'java');await settled(page);
 const boxes=await page.locator('.hm-pin[data-label] span,.hm-label').evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,t:e.textContent};}));
 const card=(await panel(page).boundingBox())!;
 expect(boxes.length).toBeGreaterThanOrEqual(9);
 const hit=(a:{x:number;y:number;w:number;h:number},b:{x:number;y:number;w:number;h:number})=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
 for(let i=0;i<boxes.length;i++){expect(hit(boxes[i],{x:card.x,y:card.y,w:card.width,h:card.height}),`${boxes[i].t} vs card`).toBe(false);for(let j=i+1;j<boxes.length;j++)expect(hit(boxes[i],boxes[j]),`${boxes[i].t} vs ${boxes[j].t}`).toBe(false);}
});

test('hover is steady: few tooltip changes along Java and across the Sumatra to Kalimantan strait, never Maritime',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await open(page);
 await page.evaluate(()=>{const w=window as unknown as {tips:string[]};w.tips=[];new MutationObserver(()=>{const t=document.querySelector('.hm-tip') as HTMLElement;if(t.dataset.on==='1'&&t.textContent!==w.tips[w.tips.length-1])w.tips.push(t.textContent!);}).observe(document.querySelector('.hm-tip')!,{childList:true,characterData:true,subtree:true});});
 const{a,b}=await regionRow(page,'java');
 await page.mouse.move(a.x,a.y);await page.mouse.move(b.x,b.y,{steps:40});await page.waitForTimeout(150);
 const java=await page.evaluate(()=>(window as unknown as {tips:string[]}).tips.length);expect(java).toBeLessThanOrEqual(2);
 const s=await regionPoint(page,'sumatra',400),k=await regionPoint(page,'kalimantan',400);
 await page.mouse.move(s.x,s.y);await page.mouse.move(k.x,k.y,{steps:40});await page.waitForTimeout(250);
 const tips=await page.evaluate(()=>(window as unknown as {tips:string[]}).tips);console.log('hover tips',tips.map(t=>t.split(' · ')[0]).join(' > '));
 expect(tips.some(t=>/Maritime/.test(t))).toBe(false);expect(tips.length-java).toBeLessThanOrEqual(4);
});

test('perf smoke: a click starts at most 40 animations (was 6,424) under a 4x CPU throttle @perf',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await open(page);
 const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 await clickRegion(page,'java');await page.waitForTimeout(50);
 expect(await page.evaluate(()=>document.getAnimations().length)).toBeLessThanOrEqual(40);
});

test.describe('mobile',()=>{test.use({hasTouch:true});
test('mobile: region chips and map taps open a peek sheet with the CTA in view; the handle expands it to the full sheet',async({page})=>{
 await page.setViewportSize({width:390,height:844});await open(page);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 expect(((await hero(page).boundingBox())!).height).toBeGreaterThanOrEqual(843);
 await page.screenshot({path:'test-results/hero-map-mobile.png',animations:'disabled'});
 await expect(panel(page)).toBeHidden();
 await page.getByRole('group',{name:'Regions'}).getByRole('button',{name:'Java'}).click();
 await expect(panel(page)).toBeVisible();await settled(page);
 const box=(await panel(page).boundingBox())!;expect(Math.round(box.y+box.height)).toBe(844);expect(box.y).toBeGreaterThanOrEqual(844-232);
 const cta=(await page.locator('[data-cta="hero-test-plan"]').boundingBox())!;expect(cta.y+cta.height).toBeLessThanOrEqual(844);
 await page.screenshot({path:'test-results/hero-map-mobile-peek.png',animations:'disabled'});
 await panel(page).getByRole('button',{name:'More details'}).click();
 await expect(panel(page).getByRole('tab',{name:/Sites/})).toBeVisible();
 await panel(page).getByRole('tab',{name:/Sites/}).click();
 await expect(panel(page).getByRole('button',{name:/Bekasi/})).toBeVisible();
 const full=(await panel(page).boundingBox())!;expect(full.height).toBeGreaterThan(600);
 expect((await page.locator('[data-cta="hero-test-plan"]').boundingBox())!.y+(await page.locator('[data-cta="hero-test-plan"]').boundingBox())!.height).toBeLessThanOrEqual(844);
 await page.screenshot({path:'test-results/hero-map-mobile-sheet.png',animations:'disabled'});
 await page.keyboard.press('Escape');await expect(panel(page).getByRole('tab',{name:/Sites/})).toBeHidden();await expect(panel(page)).toBeVisible();
 await panel(page).getByRole('button',{name:'Close details'}).click();await expect(panel(page)).toBeHidden();
 await settled(page);await expect(page.locator('.hm-stage')).not.toHaveAttribute('data-zoom',/.+/);
 const svg=(await page.locator('.hm-stage').boundingBox())!;
 await page.touchscreen.tap(svg.x+svg.width*.2,svg.y+svg.height*.3);
 await expect(panel(page)).toBeVisible();
 await expect(page.locator('.hm-lenses .hm-chips').first()).toHaveCSS('overflow-x','auto');
});
test('mobile: the CTA is visible in the peek sheet with browser chrome (390x664)',async({page})=>{
 await page.setViewportSize({width:390,height:664});await open(page);
 await page.getByRole('group',{name:'Regions'}).getByRole('button',{name:'Java'}).click();await settled(page);
 const cta=(await page.locator('[data-cta="hero-test-plan"]').boundingBox())!;expect(cta.y).toBeGreaterThan(0);expect(cta.y+cta.height).toBeLessThanOrEqual(664);
});
});

test('reduced motion: no animations on lit regions and an instant scroll jump',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:1440,height:900});await page.goto('/');
 await expect(page.locator('.rl-loader')).toBeHidden();
 await lens(page,'I build','Drone');
 expect(await page.locator('.hm-g[data-region="java"]').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
 await page.getByRole('link',{name:/Scroll to the gap/}).click();
 expect(Math.abs((await page.locator('#gap').boundingBox())!.y)).toBeLessThan(40);
});

test('Access lens shows planned labs and zones; the sources drawer and entry path are honest',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await open(page);
 await page.getByRole('button',{name:/Labs, free trade zone/}).click();
 await expect(page.locator('.hm-pin[data-planned]')).toHaveCount(3);
 await expect(page.locator('.hm-pin[data-pin="batam"]')).toBeVisible();
 await expect(page.locator('.hm-pin[data-pin="jakarta"]')).toHaveCount(0);
 await expect(page.locator('.hm-pin[data-pin="bandung"] span')).toContainText('PLANNED');
 await expect(page.locator('.hm-pin[data-pin="bandung"][data-label]')).toHaveCount(1);
 const entry=page.locator('.hm-entry');await entry.scrollIntoViewIfNeeded();
 await expect(entry).toContainText('The steps we help you through');
 await expect(entry).not.toContainText(/\bweeks?\b/i);
 expect(await entry.locator('a[href^="https://peraturan.go.id"]').count()).toBeGreaterThanOrEqual(3);
 await expect(page.locator('.rl-labs li')).toHaveCount(3);
 expect(await page.locator('.hm-map').count()).toBe(1);
});

test('Schools lens shades regions by SMK count, framed as potential reach and not partners',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await open(page);
 await page.getByRole('button',{name:/School reach/}).click();
 await expect(page.locator('.hm-label',{hasText:'8,149 SMK'})).toBeVisible();
 await expect(page.locator('.hm-g[data-region="java"]')).toHaveAttribute('data-dens','4');
 await expect(page.locator('g[data-region="maritime"]')).not.toHaveAttribute('data-dens','1');
 await expect(hero(page)).toContainText('14,000+ vocational schools nationwide');
 await expect(hero(page)).toContainText('not partners');
 await clickRegion(page,'java');
 await expect(page.getByTestId('schools-line')).toContainText('8,149 SMK in Java');
 await expect(page.getByTestId('schools-line')).toContainText('potential reach, not partners');
 await panel(page).getByRole('button',{name:'About these school counts'}).click();
 await expect(page.getByTestId('schools-full')).toContainText('8,149 vocational schools (SMK) in Java');
 await expect(page.getByTestId('schools-full')).toContainText('Existing schools, not partners');
 await expect(page.getByTestId('schools-full').getByRole('link',{name:/Lab Mitra/})).toHaveAttribute('href','/id');
 await panel(page).getByRole('tab',{name:/Sites/}).click();
 await panel(page).getByRole('button',{name:/Bekasi/}).click();
 await expect(page.getByTestId('schools-line')).toContainText('447 SMK in Kab. Bekasi');
 await panel(page).getByRole('tab',{name:'Why'}).click();
 await expect(page.getByTestId('schools-full')).toContainText('447 vocational schools (SMK) in Kab. Bekasi, Kota Bekasi and Kab. Karawang');
 await panel(page).getByRole('navigation',{name:'Breadcrumb'}).getByRole('button',{name:'Java'}).click();
 await panel(page).getByRole('tab',{name:/Sites/}).click();
 await panel(page).getByRole('button',{name:/Kendal/}).click();
 await panel(page).getByRole('tab',{name:'Why'}).click();
 await expect(page.getByTestId('schools-full')).toContainText('135 vocational schools (SMK) in Kota Semarang and Kab. Kendal only');
 await expect(page.getByTestId('schools-full').locator('sup a')).toContainText('Data Referensi Kemendikdasmen, accessed 12 Oct 2026');
});

test('placeholder company details show only on localhost, never to anonymous visitors on the public host',async({page})=>{
 await open(page);
 await expect(page.getByTestId('company-legal')).toContainText('[placeholder]');
 await expect(page.getByTestId('hero-panel')).toContainText('We reply within [X] business days [placeholder]');
 await page.goto(PUBLIC+'/');await expect(page.locator('.result-landing')).toHaveAttribute('data-ready','true');
 await expect(page.getByTestId('hero-map')).toBeVisible();
 await expect(page.getByTestId('company-legal')).toHaveCount(0);
 await expect(page.locator('body')).not.toContainText('[placeholder]');
 await expect(page.locator('body')).not.toContainText('business days');
 await page.goto(PUBLIC+'/partner');await expect(page.locator('body')).not.toContainText('[placeholder]');
});
