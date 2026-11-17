// This test loads the deliverable with the network disabled; no QA assets/server.
import {chromium,expect as playwrightExpect} from '@playwright/test';
import {readFile,writeFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const expect=playwrightExpect.configure({timeout:30000});
const file=process.argv[2]||'artifacts/em-final.html',html=await readFile(file,'utf8');
await rm('artifacts/offline.json',{force:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[],network=[];
try{
 const context=await browser.newContext({offline:true,viewport:{width:1440,height:900}}),page=await context.newPage();page.setDefaultTimeout(180000);
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
 await page.setContent(html,{waitUntil:'load',timeout:180000});
 const host=page.locator('.canvas-host');await expect(host).toHaveAttribute('data-model-source','/assets/sheep.glb',{timeout:180000});
 await page.getByRole('button',{name:'Tùy chọn',exact:true}).click();await page.getByRole('button',{name:'Hiện số đếm',exact:true}).click();await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Bắt đầu thư giãn',exact:true}).click();await expect(page.locator('main')).toHaveAttribute('data-playing','true');
 await page.waitForFunction(()=>{const el=document.querySelector('.minimal-count');return el&&Number(el.textContent)>0&&document.querySelector('.canvas-host').emFrameSamples.filter(r=>r.mode==='playing').length>=3;},{},{timeout:180000});
 await page.keyboard.press('Tab');await expect(page.getByRole('button',{name:'Tạm dừng phiên thư giãn',exact:true})).toBeFocused();await page.keyboard.press('Space');await expect(page.locator('main')).toHaveAttribute('data-playing','false');
 await page.getByRole('button',{name:/^Chọn âm thanh/}).click();await page.getByRole('button',{name:/^Tiếng suối/}).click();await expect(page.getByRole('button',{name:/^Chọn âm thanh/})).toContainText('Tiếng suối');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);expect(network).toEqual([]);
 const report={file,sha256:createHash('sha256').update(html).digest('hex'),bytes:Buffer.byteLength(html),offline:true,webgl:true,playedAndPaused:true,count:Number(await page.locator('.minimal-count').textContent()),sourceSnapshot:await page.locator('#em-project-source').count()===1,data:await host.evaluate(el=>({...el.dataset})),errors,network};
 await writeFile('artifacts/offline.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
