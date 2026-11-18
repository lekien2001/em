// This test loads the deliverable with the network disabled; no QA assets/server.
import {chromium,expect as playwrightExpect} from '@playwright/test';
import {readFile,writeFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const expect=playwrightExpect.configure({timeout:30000});
// Keyboard actions avoid stale hit testing while SwiftShader renders a dense scene.
async function activate(locator){await locator.focus();await locator.press('Enter');}
const file=process.argv[2]||'artifacts/em-final.html',html=await readFile(file,'utf8');
await rm('artifacts/offline.json',{force:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[],network=[];
try{
 const context=await browser.newContext({offline:true,viewport:{width:1440,height:900}}),page=await context.newPage();page.setDefaultTimeout(180000);
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
 await page.evaluate(()=>{const NativeWorker=window.Worker;window.__offlineWorkerMessages=0;window.Worker=class extends NativeWorker{constructor(...args){super(...args);this.addEventListener('message',()=>window.__offlineWorkerMessages++);}};});
 await page.setContent(html,{waitUntil:'load',timeout:180000});
 const host=page.locator('.canvas-host');await expect(host).toHaveAttribute('data-model-source','/assets/sheep.glb',{timeout:180000});
 await page.evaluate(()=>document.fonts.ready);
 const loadedFonts=await page.evaluate(()=>[...document.fonts].filter(f=>f.family==='Be Vietnam Pro'&&f.status==='loaded').length);expect(loadedFonts).toBeGreaterThan(0);
 await expect(page.locator('.minimal-sound span')).toHaveCSS('font-size','14px');
 const controlSizes=await page.getByRole('toolbar').getByRole('button').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return{width:r.width,height:r.height};}));expect(controlSizes.map(s=>s.width)).toEqual([44,140,44,120,44]);expect(controlSizes.every(s=>s.height===44)).toBe(true);
 const soundCenter=await page.locator('.minimal-sound').evaluate(el=>{const a=el.getBoundingClientRect(),b=el.querySelector('span').getBoundingClientRect();return Math.abs(a.x+a.width/2-b.x-b.width/2);});expect(soundCenter).toBeLessThanOrEqual(1);

 await activate(page.getByRole('button',{name:'Tùy chọn',exact:true}));await activate(page.getByRole('switch',{name:'Hiện số đếm',exact:true}));await page.keyboard.press('Escape');
 await activate(page.getByRole('button',{name:'Bắt đầu thư giãn',exact:true}));await expect(page.locator('main')).toHaveAttribute('data-playing','true');
 expect(await page.evaluate(()=>window.__offlineWorkerMessages)).toBeGreaterThan(0);
 await page.waitForFunction(()=>{const el=document.querySelector('.minimal-count');return el&&Number(el.textContent)>0&&document.querySelector('.canvas-host').emFrameSamples.filter(r=>r.mode==='playing').length>=3;},{},{timeout:180000});
 await page.keyboard.press('Tab');await expect(page.getByRole('button',{name:'Tạm dừng phiên thư giãn',exact:true})).toBeFocused();await page.keyboard.press('Space');await expect(page.locator('main')).toHaveAttribute('data-playing','false');
 const playedCount=Number(await page.locator('.minimal-count').textContent());
 await activate(page.getByRole('button',{name:'Âm lượng',exact:true}));const volume=page.getByRole('slider',{name:'Âm lượng',exact:true});await expect(volume).toBeFocused();await volume.fill('0.72');await activate(page.getByRole('button',{name:'Tắt tiếng',exact:true}));await activate(page.getByRole('button',{name:'Bật tiếng',exact:true}));await expect(volume).toHaveValue('0.72');await page.keyboard.press('Escape');
 await activate(page.getByRole('button',{name:/^Chọn âm thanh/}));await activate(page.getByRole('button',{name:/^Tiếng suối/}));await expect(page.getByRole('button',{name:/^Chọn âm thanh/})).toContainText('Tiếng suối');
 await activate(page.getByRole('button',{name:'Tùy chọn',exact:true}));await activate(page.getByRole('button',{name:'Mặt cừu của bạn',exact:true}));
 const photo=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=768;canvas.height=1024;const context=canvas.getContext('2d');context.fillStyle='#dca58c';context.fillRect(0,0,768,1024);return canvas.toDataURL().split(',')[1];});
 await page.getByLabel('Chọn ảnh khuôn mặt').setInputFiles({name:'offline-photo.png',mimeType:'image/png',buffer:Buffer.from(photo,'base64')});
 await expect(page.getByRole('button',{name:'Áp dụng',exact:true})).toBeEnabled({timeout:60000});await activate(page.getByRole('button',{name:'Áp dụng',exact:true}));await expect(host).toHaveAttribute('data-personal-face','true');
 const initialCamera=await host.getAttribute('data-camera-position');await page.locator('.canvas-host canvas').focus();await page.keyboard.press('ArrowLeft');await expect.poll(()=>host.getAttribute('data-camera-position')).not.toBe(initialCamera);const favoriteCamera=await host.getAttribute('data-camera-position');
 // Exercise all four additions inside the delivered document, including RAM-only storage.
 await activate(page.getByRole('button',{name:/^Chọn âm thanh/}));await activate(page.getByRole('tab',{name:'Trộn',exact:true}));for(const name of ['Mưa nhẹ','Brown noise'])await activate(page.getByRole('switch',{name,exact:true}));await expect(page.locator('.minimal-sound')).toContainText('Bản phối');await page.keyboard.press('Escape');
 await activate(page.getByRole('button',{name:/^Hẹn giờ:/}));await page.getByLabel('Số phút tùy chỉnh',{exact:true}).fill('45');await page.getByLabel('Số phút tùy chỉnh',{exact:true}).focus();const fieldFocus=await page.getByLabel('Số phút tùy chỉnh',{exact:true}).evaluate(el=>{const s=getComputedStyle(el);return{height:el.getBoundingClientRect().height,outline:s.outlineStyle,shadow:s.boxShadow};});expect(fieldFocus.height).toBe(44);expect(fieldFocus.outline).toBe('none');expect(fieldFocus.shadow).toMatch(/0px 0px 0px 2px/);await activate(page.getByRole('button',{name:'Áp dụng',exact:true}));await activate(page.getByRole('button',{name:'1 phút',exact:true}));await page.keyboard.press('Escape');
 await activate(page.getByRole('button',{name:'Tùy chọn',exact:true}));await activate(page.getByRole('button',{name:'Phiên yêu thích',exact:true}));await page.getByLabel('Lưu cấu hình hiện tại',{exact:true}).fill('Offline');await activate(page.getByRole('button',{name:'Lưu',exact:true}));await expect(page.getByRole('article',{name:'Offline',exact:true})).toBeVisible();
 const favoriteCard=page.getByRole('article',{name:'Offline',exact:true});const actionSizes=await favoriteCard.locator('.favorite-actions button').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return{width:r.width,height:r.height};}));expect(Math.max(...actionSizes.map(s=>s.width))-Math.min(...actionSizes.map(s=>s.width))).toBeLessThanOrEqual(1);expect(actionSizes.every(s=>s.height===44)).toBe(true);
 await activate(page.getByRole('button',{name:'Đổi tên',exact:true}));await expect(favoriteCard.locator('.favorite-actions')).toHaveCount(0);await page.getByLabel('Đổi tên phiên',{exact:true}).fill('Offline mới');await activate(page.getByRole('button',{name:'Lưu tên',exact:true}));await expect(page.getByRole('button',{name:'Đổi tên',exact:true})).toBeFocused();await activate(page.getByRole('button',{name:'Xóa',exact:true}));await expect(page.getByRole('button',{name:'Hủy',exact:true})).toBeFocused();await activate(page.getByRole('button',{name:'Hủy',exact:true}));await expect(page.getByRole('button',{name:'Xóa',exact:true})).toBeFocused();await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Phát phiên thư giãn',exact:true}).focus();await page.keyboard.press('Enter');await expect(page.locator('main')).toHaveAttribute('data-playing','true');await page.keyboard.press('Tab');await expect(page.getByRole('button',{name:'Tạm dừng phiên thư giãn',exact:true})).toBeFocused();
 await activate(page.getByRole('button',{name:'Tùy chọn',exact:true}));await activate(page.getByRole('button',{name:'Phiên yêu thích',exact:true}));await activate(page.getByRole('button',{name:'Áp dụng',exact:true}));await expect(page.locator('main')).toHaveAttribute('data-playing','false');await expect(page.locator('main')).toHaveAttribute('data-remaining','2700000');await expect(page.locator('.minimal-count')).toHaveText('00');
 await expect(host).toHaveAttribute('data-personal-face','true');await expect(host).toHaveAttribute('data-camera-position',favoriteCamera);
 await activate(page.getByRole('button',{name:'Tùy chọn',exact:true}));await activate(page.getByRole('button',{name:'Mặt cừu của bạn',exact:true}));await activate(page.getByRole('button',{name:'Khôi phục',exact:true}));await page.keyboard.press('Escape');await expect(host).toHaveAttribute('data-personal-face','false');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);expect(network).toEqual([]);
 const report={file,sha256:createHash('sha256').update(html).digest('hex'),bytes:Buffer.byteLength(html),offline:true,webgl:true,loadedFonts,workerMessages:await page.evaluate(()=>window.__offlineWorkerMessages),playedAndPaused:true,muteRestored72Percent:true,personalFaceAppliedAndRestored:true,count:playedCount,mixerFavoriteCustomTimerAndFade:true,controlGeometryFocusAndCardModes:true,favoriteKeepsCameraAndPhoto:true,sourceSnapshot:await page.locator('#em-project-source').count()===1,data:await host.evaluate(el=>({...el.dataset})),errors,network};
 await context.close();
 // The same deliverable must also work without Worker or WebGL, still offline.
 const fallbackContext=await browser.newContext({offline:true,viewport:{width:1440,height:900}});let fallback=await fallbackContext.newPage();
 fallback.on('pageerror',e=>errors.push(e.message));fallback.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
 const setupFallback=()=>{window.Worker=class{constructor(){throw new Error('Worker blocked by test');}};const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/.test(type)?null:get.call(this,type,...args);};};
 await fallback.addInitScript(setupFallback);
 let fileUrlVerified=true;
 try { await fallback.goto(pathToFileURL(resolve(file)).href,{waitUntil:'load',timeout:180000}); }
 catch(error){if(!String(error).includes('ERR_BLOCKED_BY_ADMINISTRATOR'))throw error;fileUrlVerified=false;report.fileUrlLimitation='Managed Chromium blocks file:// navigation. Offline embedded HTML and storage are tested separately without changing administrator policy.';await fallback.close();fallback=await fallbackContext.newPage();fallback.on('pageerror',e=>errors.push(e.message));fallback.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});await fallback.evaluate(setupFallback);await fallback.setContent(html,{waitUntil:'load',timeout:180000});}

 await activate(fallback.getByRole('button',{name:'Bắt đầu thư giãn',exact:true}));await expect(fallback.locator('main')).toHaveAttribute('data-playing','true');
 await fallback.keyboard.press('Tab');await expect(fallback.getByRole('button',{name:'Tạm dừng phiên thư giãn',exact:true})).toBeFocused();await fallback.keyboard.press('Space');await expect(fallback.locator('main')).toHaveAttribute('data-playing','false');
 await activate(fallback.getByRole('button',{name:'Tùy chọn',exact:true}));await activate(fallback.getByRole('button',{name:'Phiên yêu thích',exact:true}));await fallback.getByLabel('Lưu cấu hình hiện tại',{exact:true}).fill('Tệp cục bộ');await activate(fallback.getByRole('button',{name:'Lưu',exact:true}));await expect(fallback.getByRole('article',{name:'Tệp cục bộ',exact:true})).toBeVisible();if(fileUrlVerified){await fallback.reload();await expect(fallback.locator('main')).toHaveAttribute('data-playing','false');await activate(fallback.getByRole('button',{name:'Tùy chọn',exact:true}));await activate(fallback.getByRole('button',{name:'Phiên yêu thích',exact:true}));await expect(fallback.getByRole('article',{name:'Tệp cục bộ',exact:true})).toBeVisible();}else{await expect(fallback.getByText(/Thay đổi chỉ được giữ/)).toBeVisible();}
 report.fileUrlVerified=fileUrlVerified;report.workerAndWebglFallback=true;expect(errors).toEqual([]);expect(network).toEqual([]);
 const recordingPage = await fallbackContext.newPage();
 const recordingRequests = [];
 recordingPage.on('pageerror',error=>errors.push(error.message));
 recordingPage.on('request',request=>{if(/^https?:/.test(request.url()))recordingRequests.push(request.url());});
 await recordingPage.evaluate(setupFallback);
 await recordingPage.setContent(html,{waitUntil:'load',timeout:180000});
 const recordingPicker = recordingPage.getByRole('button',{name:/^Chọn âm thanh/});
 await activate(recordingPicker);
 await activate(recordingPage.getByRole('button',{name:'Mưa bên cửa sổ',exact:true}));
 expect(recordingRequests).toEqual([]);
 await activate(recordingPage.getByRole('button',{name:'Bắt đầu thư giãn',exact:true}));
 await expect(recordingPage.locator('main')).toHaveAttribute('data-playing','true');
 await expect(recordingPage.getByRole('status').filter({hasText:'Đang phát Mưa nhẹ tổng hợp.'})).toBeVisible();
 await expect(recordingPage.locator('.minimal-sound')).toContainText('Mưa bên cửa sổ');
 expect(recordingRequests.length).toBeGreaterThan(0);
 expect(recordingRequests.every(url=>url.startsWith('https://raw.githubusercontent.com/lekien2001/storage/'))).toBe(true);
 report.offlineRecordingFallback=true;
 await fallbackContext.close();
 // Test persistent storage using an offline, intercepted local origin; no server request is sent.
 const storageContext=await browser.newContext({offline:true,viewport:{width:1440,height:900}});await storageContext.addInitScript(setupFallback);const storagePage=await storageContext.newPage();storagePage.on('pageerror',e=>errors.push(e.message));const origin='http://127.0.0.1:4173/portable-storage-qa';const storageRequests=[];storagePage.on('request',r=>storageRequests.push(r.url()));await storagePage.route(origin,route=>route.fulfill({contentType:'text/html',body:html}));await storagePage.goto(origin);await activate(storagePage.getByRole('button',{name:'Tùy chọn',exact:true}));await activate(storagePage.getByRole('button',{name:'Phiên yêu thích',exact:true}));await storagePage.getByLabel('Lưu cấu hình hiện tại',{exact:true}).fill('Lưu offline');await activate(storagePage.getByRole('button',{name:'Lưu',exact:true}));await storagePage.reload();await expect(storagePage.locator('main')).toHaveAttribute('data-playing','false');await activate(storagePage.getByRole('button',{name:'Tùy chọn',exact:true}));await activate(storagePage.getByRole('button',{name:'Phiên yêu thích',exact:true}));await expect(storagePage.getByRole('article',{name:'Lưu offline',exact:true})).toBeVisible();expect(storageRequests.every(url=>url===origin)).toBe(true);report.persistedWithNetworkDisabled=true;await storageContext.close();expect(errors).toEqual([]);
 await writeFile('artifacts/offline.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
