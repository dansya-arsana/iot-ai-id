import {test,expect,type Page} from '@playwright/test';

const PUBLIC='http://iot.admin.localhost:8891';
const hero=(page:Page)=>page.getByTestId('hero-map');
async function open(page:Page,url='/'){await page.goto(url);await expect(page.locator('.result-landing')).toHaveAttribute('data-ready','true');await expect(page.locator('.rl-loader')).toBeHidden();}
/** Clicks the centre of a region's first dot with the real mouse (dots are tiny; the map resolves the nearest region). */
async function clickRegion(page:Page,id:string){const box=await page.locator(`.hm-g[data-region="${id}"] circle`).nth(30).boundingBox();await page.mouse.click(box!.x+box!.width/2,box!.y+box!.height/2);}
const panel=(page:Page)=>page.getByTestId('hero-panel');

test('hero fills the viewport, leads with the headline and shows the proof line',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await open(page);
 const box=(await hero(page).boundingBox())!;expect(box.height).toBeGreaterThanOrEqual(899);
 await expect(page.getByRole('heading',{level:1})).toHaveText('Prove your robot where it actually breaks.');
 await expect(page.locator('.rl-eyebrow').first()).toHaveText('The real-world gateway for AI robotics in Indonesia');
 await expect(hero(page)).toContainText('National mean air temperature 27.5 °C in 2024 (BMKG)');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await expect(page.locator('.hm-g circle').first()).toBeAttached();
 expect(await page.locator('.hm-g[data-region="java"] circle').first().getAttribute('data-region')).toBe('java');
 await page.screenshot({path:'test-results/hero-map-desktop.png',animations:'disabled'});
});

test('picking a robot type brightens the regions that fit; the sea and neighbours stay',async({page})=>{
 await open(page);
 await page.getByRole('button',{name:'Drone',exact:true}).click();
 await expect(page.locator('.hm-g[data-region="java"]')).toHaveAttribute('data-s','lit');
 await expect(page.locator('.hm-g[data-region="sulawesi"]')).toHaveAttribute('data-s','dim');
 await page.getByRole('button',{name:'Marine',exact:true}).click();
 await expect(page.locator('.hm-g[data-region="sulawesi"]')).toHaveAttribute('data-s','lit');
 await page.getByRole('button',{name:'Heat & humidity'}).click();
 await expect(page.locator('.hm-g[data-region="sulawesi"]')).toHaveAttribute('data-s','lit');
 await expect(page.locator('.hm-g[data-region="maluku"]')).toHaveAttribute('data-s','dim');
 await page.getByRole('button',{name:'Clear'}).click();
 await expect(page.locator('.hm-g[data-region="maluku"]')).toHaveAttribute('data-s','base');
});

test('clicking a region opens a panel with at most three sourced facts, tests and a CTA; keyboard Enter and Esc work',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await open(page);
 await clickRegion(page,'sumatra');
 await expect(panel(page).getByRole('heading',{name:'Sumatra'})).toBeVisible();
 expect(await panel(page).locator('.hm-facts li').count()).toBeLessThanOrEqual(3);
 await expect(panel(page).locator('.hm-facts li sup a').first()).toContainText(/\d{4}/);
 await expect(panel(page)).toContainText('19.06%');
 await expect(panel(page).getByRole('link',{name:/Get a test plan · Sumatra/})).toBeVisible();
 await page.screenshot({path:'test-results/hero-map-region-desktop.png',animations:'disabled'});
 await page.keyboard.press('Escape');
 await expect(panel(page).getByRole('heading',{name:'Where would it break?'})).toBeVisible();
 await page.locator('.hm-g[data-region="java"]').focus();await page.keyboard.press('Enter');
 await expect(panel(page).getByRole('heading',{name:'Java'})).toBeFocused();
 await page.keyboard.press('Escape');
 await expect(panel(page).getByRole('heading',{name:'Where would it break?'})).toBeVisible();
 await expect(page.locator('.hm-g[data-region="java"]')).toBeFocused();
 // the sea is its own region
 await page.locator('g[data-region="maritime"]').focus();await page.keyboard.press('Enter');
 await expect(panel(page).getByRole('heading',{name:'Maritime Indonesia'})).toBeVisible();
 // the Sources drawer lists every fact with confidence badges, low ones included
 await panel(page).getByRole('button',{name:'Sources'}).click();
 const drawer=page.getByRole('dialog',{name:/Sources & confidence/});await expect(drawer).toBeVisible();
 await expect(drawer.locator('.hm-conf[data-conf="L"]').first()).toBeVisible();
 await expect(drawer).toContainText('What we don\'t know yet');
 await page.keyboard.press('Escape');await expect(drawer).toBeHidden();
});

test('the month lens changes regional states and labels the pattern as typical',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await open(page);
 await page.getByRole('button',{name:'Aug',exact:true}).click();
 await expect(page.locator('.hm-g[data-region="sumatra"]')).toHaveAttribute('data-season','haze');
 await expect(page.locator('.hm-g[data-region="java"]')).toHaveAttribute('data-season','dry');
 await expect(page.locator('.hm-g[data-region="sulawesi"]')).toHaveAttribute('data-season','none');
 await expect(hero(page)).toContainText('typical pattern, BMKG; varies by zone and year');
 await page.screenshot({path:'test-results/hero-map-month-desktop.png',animations:'disabled'});
 await page.getByRole('button',{name:'Jul',exact:true}).click();
 await expect(page.locator('.hm-g[data-region="maluku"]')).toHaveAttribute('data-season','wet');
 await page.getByRole('button',{name:'Jan',exact:true}).click();
 await expect(page.locator('.hm-g[data-region="java"]')).toHaveAttribute('data-season','wet');
 await expect(page.locator('.hm-g[data-region="sumatra"]')).toHaveAttribute('data-season','wet');
});

test('Java shows its hotspots; a hotspot panel carries its site into the partner form and the stored inquiry',async({page,request})=>{
 await page.setViewportSize({width:1440,height:900});await open(page);
 await expect(page.locator('.hm-pin[data-pin="jakarta"]')).toBeVisible();
 await expect(page.locator('.hm-pin[data-pin="gresik-jiipe"]')).toHaveCount(0);
 await clickRegion(page,'java');
 await expect(panel(page).getByRole('heading',{name:'Cities & potential areas'})).toBeVisible();
 expect(await page.locator('.hm-pin[data-kind]').count()).toBeGreaterThanOrEqual(9);
 await page.screenshot({path:'test-results/hero-map-java-hotspots-desktop.png',animations:'disabled'});
 await page.getByRole('button',{name:'Drone',exact:true}).click();
 await panel(page).getByRole('button',{name:/Semarang & KEK Kendal/}).click();
 await expect(panel(page).getByRole('heading',{name:'Semarang & KEK Kendal'})).toBeVisible();
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
 await page.getByRole('button',{name:'Drone',exact:true}).click();
 await page.getByRole('button',{name:'Aug',exact:true}).click();
 await page.getByRole('button',{name:'Haze & dust'}).click();
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

test('the scroll button lands on #gap without adding history; one wheel flick assists once',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await open(page);
 const before=await page.evaluate(()=>history.length);
 await page.getByRole('link',{name:/Scroll to the gap/}).click();
 await expect.poll(async()=>Math.abs((await page.locator('#gap').boundingBox())!.y)).toBeLessThan(40);
 expect(await page.evaluate(()=>history.length)).toBe(before);
 await page.evaluate(()=>window.scrollTo(0,0));
 await page.reload();await expect(page.locator('.result-landing')).toHaveAttribute('data-ready','true');await page.evaluate(()=>window.scrollTo(0,0));
 await page.mouse.move(700,500);await page.mouse.wheel(0,100);
 await expect.poll(async()=>Math.abs((await page.locator('#gap').boundingBox())!.y)).toBeLessThan(40);
 // after the first jump the assist is gone: scrolling back up is native and does not snap back
 await page.evaluate(()=>window.scrollTo(0,0));await page.mouse.wheel(0,100);
 await page.waitForTimeout(800);expect(await page.evaluate(()=>window.scrollY)).toBeLessThan(300);
});

test('wheeling inside an open panel does not trigger the scroll assist',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await open(page);
 await clickRegion(page,'java');
 const box=(await panel(page).boundingBox())!;await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.wheel(0,60);
 await page.waitForTimeout(700);expect(await page.evaluate(()=>window.scrollY)).toBeLessThan(120);
});

test.describe('mobile',()=>{test.use({hasTouch:true});
test('mobile: region chips and map taps open a bottom sheet that lists the hotspots',async({page})=>{
 await page.setViewportSize({width:390,height:844});await open(page);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 expect(((await hero(page).boundingBox())!).height).toBeGreaterThanOrEqual(843);
 await page.screenshot({path:'test-results/hero-map-mobile.png',animations:'disabled'});
 await expect(panel(page)).toBeHidden();
 await page.getByRole('group',{name:'Regions'}).getByRole('button',{name:'Java'}).click();
 await expect(panel(page)).toBeVisible();
 const box=(await panel(page).boundingBox())!;expect(Math.round(box.y+box.height)).toBe(844);
 await expect(panel(page).getByRole('heading',{name:'Cities & potential areas'})).toBeVisible();
 await page.screenshot({path:'test-results/hero-map-mobile-sheet.png',animations:'disabled'});
 await panel(page).getByRole('button',{name:'Close details'}).click();await expect(panel(page)).toBeHidden();
 const svg=(await page.locator('.hm-map svg').boundingBox())!;
 await page.touchscreen.tap(svg.x+svg.width*.2,svg.y+svg.height*.3);
 await expect(panel(page)).toBeVisible();
 await expect(page.locator('.hm-lenses .hm-chips').first()).toHaveCSS('overflow-x','auto');
});
});

test('reduced motion: no shimmer and an instant scroll jump',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:1440,height:900});await page.goto('/');
 await expect(page.locator('.rl-loader')).toBeHidden();
 await page.getByRole('button',{name:'Drone',exact:true}).click();
 expect(await page.locator('.hm-g[data-region="java"]').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
 await page.getByRole('link',{name:/Scroll to the gap/}).click();
 expect(Math.abs((await page.locator('#gap').boundingBox())!.y)).toBeLessThan(40);
});

test('Access lens shows planned labs and zones; the sources drawer and entry path are honest',async({page})=>{
 await open(page);
 await page.getByRole('button',{name:/Labs, free trade zone/}).click();
 await expect(page.locator('.hm-pin[data-planned]')).toHaveCount(3);
 await expect(page.locator('.hm-pin[data-pin="batam"]')).toBeVisible();
 await expect(page.locator('.hm-pin[data-pin="jakarta"]')).toHaveCount(0);
 await expect(page.locator('.hm-pin[data-pin="bandung"] span')).toContainText('PLANNED');
 const entry=page.locator('.hm-entry');await entry.scrollIntoViewIfNeeded();
 await expect(entry).toContainText('The steps we help you through');
 await expect(entry).not.toContainText(/\bweeks?\b/i);
 expect(await entry.locator('a[href^="https://peraturan.go.id"]').count()).toBeGreaterThanOrEqual(3);
 await expect(page.locator('.rl-labs li')).toHaveCount(3);
 expect(await page.locator('.hm-map svg').count()).toBe(1);
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
 await expect(page.getByTestId('schools-line')).toContainText('8,149 vocational schools (SMK) in Java');
 await expect(page.getByTestId('schools-line').getByRole('link',{name:/Lab Mitra/})).toHaveAttribute('href','/id');
 await panel(page).getByRole('button',{name:/Bekasi–Karawang corridor/}).click();
 await expect(page.getByTestId('schools-line')).toContainText('447 vocational schools (SMK) in Kab. Bekasi, Kota Bekasi and Kab. Karawang');
 await panel(page).getByRole('button',{name:/← Java/}).click();
 await panel(page).getByRole('button',{name:/Semarang & KEK Kendal/}).click();
 await expect(page.getByTestId('schools-line')).toContainText('135 vocational schools (SMK) in Kota Semarang and Kab. Kendal only');
 await expect(page.getByTestId('schools-line').locator('sup a')).toContainText('Data Referensi Kemendikdasmen, accessed 12 Oct 2026');
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
