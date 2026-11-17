import{test,expect}from'@playwright/test';
import fs from'node:fs';
import{createHash}from'node:crypto';
for(const[width,height]of[[1366,768],[1440,900],[1920,1080]])for(const dpr of[1,1.25,1.5])test(`readable Vietnamese controls ${width}×${height} DPR ${dpr}`,async({browser})=>{
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr}),page=await context.newPage();
 try{await page.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type:any,...args:any[]){return /webgl/.test(type)?null:(get as any).call(this,type,...args);} as any;});await page.goto('/');await page.evaluate(()=>document.fonts.ready);
 const label=page.locator('.minimal-sound span');expect(await label.evaluate(e=>getComputedStyle(e).fontFamily)).toContain('Be Vietnam Pro');expect(await label.evaluate(e=>getComputedStyle(e).fontSize)).toBe('14px');expect(await page.evaluate(()=>[...document.fonts].filter(f=>f.family==='Be Vietnam Pro'&&f.status==='loaded').length)).toBeGreaterThan(0);
 await page.getByRole('button',{name:/^Chọn âm thanh/}).click();await page.getByRole('button',{name:/^Tiếng suối/}).click();await expect(label).toHaveText('Tiếng suối');
 const cdp=await context.newCDPSession(page);await cdp.send('DOM.enable');await cdp.send('CSS.enable');const doc=await cdp.send('DOM.getDocument');const node=await cdp.send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'.minimal-sound span'});const fonts=await cdp.send('CSS.getPlatformFontsForNode',{nodeId:node.nodeId});expect(fonts.fonts.some(f=>f.isCustomFont&&f.familyName.includes('Be Vietnam'))).toBe(true);
 await page.getByRole('button',{name:'Tùy chọn',exact:true}).click();await expect(page.getByRole('heading',{name:'Tùy chọn',exact:true})).toHaveCSS('font-size','20px');await page.keyboard.press('Escape');
 expect(await page.locator('.minimal-bar').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }finally{await context.close();}
});
test('font provenance is intact and font failure keeps controls usable',async({page})=>{
 const manifest=JSON.parse(fs.readFileSync('src/assets/fonts.json','utf8'));expect(manifest.assets).toHaveLength(6);for(const asset of manifest.assets)expect(createHash('sha256').update(fs.readFileSync('public/assets/'+asset.file)).digest('hex')).toBe(asset.sha256);
 await page.route('**/*.woff2',route=>route.abort());await page.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type:any,...args:any[]){return /webgl/.test(type)?null:(get as any).call(this,type,...args);} as any;});await page.goto('/');await page.evaluate(()=>document.fonts.ready);await expect(page.getByRole('button',{name:'Bắt đầu thư giãn',exact:true})).toBeVisible();await page.getByRole('button',{name:'Tùy chọn',exact:true}).click();await expect(page.getByRole('heading',{name:'Tùy chọn',exact:true})).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Tùy chọn',exact:true})).toBeFocused();
});
