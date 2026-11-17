// Real-clock diagnostic only. Do not run beside another WebGL workload.
import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[],errors=[];
const stats=rows=>{const a=rows.map(r=>r.intervalMs).sort((a,b)=>a-b),pick=q=>a[Math.min(a.length-1,Math.ceil(a.length*q)-1)];return {n:a.length,medianMs:pick(.5),p95Ms:pick(.95),over50ms:a.filter(n=>n>50).length,drawCalls:[Math.min(...rows.map(r=>r.drawCalls)),Math.max(...rows.map(r=>r.drawCalls))],triangles:[Math.min(...rows.map(r=>r.triangles)),Math.max(...rows.map(r=>r.triangles))]};};
try{for(const [width,height]of [[1366,768],[1440,900],[1920,1080]]){
 const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();page.setDefaultTimeout(180000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('http://127.0.0.1:4173/');const host=page.locator('.canvas-host');await expect(host).toHaveAttribute('data-model-source','/assets/sheep.glb',{timeout:90000});
 const renderer=await page.locator('canvas').evaluate(c=>{const gl=c.getContext('webgl2'),e=gl.getExtension('WEBGL_debug_renderer_info');return e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);});
 for(const mode of ['drag-paused','playing','drag-playing']){
  await host.evaluate(el=>el.emFrameSamples.length=0);
  if(mode==='playing'){await page.getByRole('button',{name:'Bắt đầu thư giãn',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.canvas-host').emFrameSamples.filter(r=>r.mode==='playing').length>=7,{},{timeout:180000});}
  else {const x=width*.5,y=height*.5;await page.mouse.move(x,y);await page.mouse.down();for(let i=0;i<9;i++){const before=await host.getAttribute('data-rendered-frames');await page.mouse.move(x+8+i*2,y+.3*i);await page.waitForFunction(n=>document.querySelector('.canvas-host').dataset.renderedFrames!==n,before,{timeout:180000});}await page.mouse.up();}
  const samples=await host.evaluate((el,mode)=>el.emFrameSamples.filter(r=>r.mode===mode),mode),data=await host.evaluate(el=>({...el.dataset}));
  const row={width,height,mode,renderer,...stats(samples),data};results.push(row);console.log(JSON.stringify(row));
  if(mode==='drag-paused'){await page.locator('canvas').focus();await page.keyboard.press('Home');await page.waitForTimeout(1100);}
 }
 await context.close();
}await mkdir('artifacts',{recursive:true});await writeFile('artifacts/performance.json',JSON.stringify({clock:'real performance.now; no fake clock; one browser, serial cases',limitations:'Small diagnostic sample on SwiftShader, not an HP PC GPU performance claim',results,errors},null,2));expect(errors).toEqual([]);
}finally{await browser.close();}
