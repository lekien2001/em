import {test,expect} from '@playwright/test';
async function fallback(page:any){await page.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type:any,...args:any[]){if(/webgl/.test(type))return null;return (get as any).call(this,type,...args);} as any;});}
const play=(page:any)=>page.getByRole('button',{name:'Bắt đầu thư giãn',exact:true});
for(const [width,height]of [[1366,768],[1440,900],[1920,1080]])test(`desktop ${width}: minimal controls, audio library, timer and keyboard`,async({page})=>{
 await page.setViewportSize({width,height});await fallback(page);await page.goto('/');await expect(play(page)).toBeVisible();
 await page.getByRole('button',{name:'Tùy chọn',exact:true}).click();await expect(page.getByRole('button',{name:'Về góc ban đầu',exact:true})).toBeDisabled();await page.keyboard.press('Escape');
 await expect(page.getByRole('button',{name:'Tùy chọn',exact:true})).toBeFocused();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await play(page).click();await expect(page.locator('main')).toHaveAttribute('data-playing','true');await page.keyboard.press('Tab');await expect(page.getByRole('button',{name:'Tạm dừng phiên thư giãn',exact:true})).toBeFocused();await page.keyboard.press('Space');await expect(page.locator('main')).toHaveAttribute('data-playing','false');
});

test('desktop UI hides after play and reveals on mouse/keyboard; dialogs hold it open',async({page})=>{
 await fallback(page);await page.clock.install();await page.goto('/');await page.clock.pauseAt(await page.evaluate(()=>Date.now()+100));await play(page).click();await expect(page.locator('main')).toHaveAttribute('data-playing','true');await page.clock.runFor(300);
 await expect(page.locator('main')).toHaveAttribute('data-playing','true');await page.mouse.move(700,300);await page.clock.runFor(20);await expect(page.getByRole('button',{name:'Tùy chọn',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Tùy chọn',exact:true}).click();await page.clock.fastForward(5000);await expect(page.getByRole('switch',{name:'Hiện số đếm',exact:true})).toBeVisible();await page.keyboard.press('Escape');
 await page.mouse.move(720,310);await page.clock.runFor(3010);await expect(page.locator('main')).toHaveClass(/is-immersed/);await page.clock.runFor(300);await expect(page.getByRole('button',{name:'Tùy chọn',exact:true})).not.toBeVisible();await page.keyboard.press('Tab');await page.clock.runFor(20);await expect(page.getByRole('button',{name:'Tạm dừng phiên thư giãn',exact:true})).toBeFocused();
});

test('missing storage and audio failure retain actionable controls',async({page})=>{
 await fallback(page);await page.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new Error('storage unavailable');}});class FailedAudio{constructor(){throw new Error('audio unavailable');}}Object.defineProperty(window,'AudioContext',{value:FailedAudio});});
 await page.goto('/');await play(page).click();await expect(page.locator('main')).toHaveAttribute('data-playing','false');await expect(page.getByRole('alert')).toContainText('Chưa thể phát âm thanh');await expect(page.getByRole('button',{name:'Thử lại',exact:true})).toBeVisible();
});

test('sound/volume persist and timer fades, pauses and expires by real deadline',async({page})=>{
 await fallback(page);await page.clock.install({time:new Date('2026-01-01T00:00:00Z')});await page.clock.pauseAt(new Date('2026-01-01T00:01:00Z'));await page.goto('/');
 await page.getByRole('button',{name:/^Chọn âm thanh/}).click();await page.getByRole('button',{name:/^Tiếng suối/}).click();await expect.poll(()=>page.evaluate(()=>localStorage.getItem('em:sound'))).toBe('stream');
 await page.getByRole('button',{name:'Âm lượng',exact:true}).click();const slider=page.getByRole('slider',{name:'Âm lượng',exact:true});await slider.focus();await slider.press('End');await expect.poll(()=>page.evaluate(()=>localStorage.getItem('em:volume'))).toBe('1');await page.keyboard.press('Escape');
 await page.getByRole('button',{name:/^Hẹn giờ:/}).click();await page.getByRole('button',{name:'15 phút',exact:true}).click();await expect(page.locator('main')).toHaveAttribute('data-remaining','900000');
 await play(page).click();await expect(page.locator('main')).toHaveAttribute('data-playing','true');await page.clock.fastForward(886000);await expect.poll(async()=>Number(await page.locator('main').getAttribute('data-fade'))).toBeLessThan(1);expect(Number(await page.locator('main').getAttribute('data-fade'))).toBeGreaterThan(0);
 await page.keyboard.press('Tab');await page.clock.runFor(20);await page.keyboard.press('Space');await expect(page.locator('main')).toHaveAttribute('data-playing','false');const left=await page.locator('main').getAttribute('data-remaining');await page.clock.fastForward(60000);await expect(page.locator('main')).toHaveAttribute('data-remaining',left!);
 await page.getByRole('button',{name:'Phát phiên thư giãn',exact:true}).click();await expect(page.locator('main')).toHaveAttribute('data-playing','true');await page.clock.setSystemTime(await page.evaluate(()=>Date.now()+Number(document.querySelector('main')!.getAttribute('data-remaining'))+1000));await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await page.clock.runFor(20);
 await expect(page.locator('main')).toHaveAttribute('data-playing','false');await expect(page.locator('main')).toHaveAttribute('data-remaining','0');await expect(page.locator('main')).toHaveAttribute('data-fade','0.000');
});

test('real WebGL: flattened barn, motion, pause, reduced mode and reset camera preserve the session',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[],bad:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)bad.push(r.url());});
 await page.clock.install();await page.goto('/?qa=1');const host=page.locator('.canvas-host');await expect(host).toHaveAttribute('data-model-source','/assets/sheep.glb',{timeout:90000});await page.clock.pauseAt(await page.evaluate(()=>Date.now()+30));
 expect(await page.evaluate(()=>globalThis.__emQA.adapters.groundHeight(7.3,-7.7))).toBeCloseTo(-.15,8);await expect(host).toHaveAttribute('data-grass-instances','144171');await expect(host).toHaveAttribute('data-flower-instances','639');
 await play(page).click();await expect(page.locator('main')).toHaveAttribute('data-playing','true');await page.clock.fastForward(2200);await page.keyboard.press('Tab');await page.clock.runFor(20);await page.keyboard.press('Space');await page.clock.runFor(20);await expect(page.locator('main')).toHaveAttribute('data-playing','false');
 const frozen=await page.evaluate(()=>{const q=globalThis.__emQA;return {phase:q.phase,time:q.activeSeconds,door:q.world.doorState(),body:q.world.actors[0].root.getObjectByName('Body').position.toArray(),head:q.world.actors[0].root.getObjectByName('Head').quaternion.toArray()};});
 await page.locator('canvas').focus();await page.keyboard.press('ArrowLeft');await page.clock.runFor(20);await page.clock.fastForward(5000);
 expect(await page.evaluate(()=>{const q=globalThis.__emQA;return {phase:q.phase,time:q.activeSeconds,door:q.world.doorState(),body:q.world.actors[0].root.getObjectByName('Body').position.toArray(),head:q.world.actors[0].root.getObjectByName('Head').quaternion.toArray()};})).toEqual(frozen);
 await expect(host).toHaveAttribute('data-dynamic-shadow-updated','false');await expect(host).toHaveAttribute('data-static-shadow-bakes','1');
 await page.getByRole('button',{name:'Tùy chọn',exact:true}).click();await page.getByRole('switch',{name:'Giảm chuyển động',exact:true}).click();await page.keyboard.press('Escape');await page.locator('canvas').focus();await page.keyboard.press('Home');await page.clock.runFor(20);await expect(host).toHaveAttribute('data-camera-position','6.000,5.000,20.500');
 await page.getByRole('button',{name:'Phát phiên thư giãn',exact:true}).click();await page.clock.fastForward(1200);expect(await page.evaluate(()=>globalThis.__emQA.controllers.every(c=>Math.abs(c.diagnostics.headYaw)<1e-9&&Math.abs(c.diagnostics.earL)<1e-9))).toBe(true);await expect(page.locator('main')).toHaveAttribute('data-playing','true');expect(errors).toEqual([]);expect(bad).toEqual([]);
});
