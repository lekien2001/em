import {test,expect} from '@playwright/test';
import {build} from 'esbuild';
import fs from 'node:fs/promises';

test.beforeAll(async()=>{
 await build({entryPoints:['tests/support/lifecycle-harness.tsx'],bundle:true,minify:true,define:{'process.env.NODE_ENV':'"production"'},format:'iife',outfile:'dist/lifecycle-qa.js'});
 await fs.writeFile('dist/lifecycle-qa.html','<!doctype html><html><head><link rel="icon" href="data:,"><link rel="stylesheet" href="/style.css"></head><body><div id="root" class="app"></div><script src="/lifecycle-qa.js"></script></body></html>');
});

test('StrictMode app mount/start/unmount/remount closes each audio context once',async({page})=>{
 await page.addInitScript(()=>{
  const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind:any,...args:any[]){if(/webgl/.test(kind))return null;return (get as any).call(this,kind,...args);} as any;
  const Real=AudioContext,stats={created:0,closed:0};Object.assign(window,{__audioLifecycle:stats});
  window.AudioContext=class extends Real{constructor(...args:ConstructorParameters<typeof AudioContext>){super(...args);stats.created++;}close(){stats.closed++;return super.close();}};
 });
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/lifecycle-qa.html');
 for(let i=0;i<2;i++){
  await page.evaluate(()=>{(window as any).__emLifecycle.mountApp();});await page.getByRole('button',{name:'Bắt đầu thư giãn',exact:true}).click();await expect(page.locator('main')).toHaveAttribute('data-playing','true');await page.evaluate(()=>{(window as any).__emLifecycle.unmountApp();});
  await expect.poll(()=>page.evaluate(()=>(window as any).__audioLifecycle.closed)).toBe(i+1);expect(await page.locator('main').count()).toBe(0);
 }
 expect(await page.evaluate(()=>(window as any).__audioLifecycle)).toEqual({created:2,closed:2});expect(errors).toEqual([]);
});

test('real renderer disposes shared GPU resources once, cancels frames and handles early teardown',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.setViewportSize({width:1366,height:768});await page.goto('/lifecycle-qa.html?qa=1');await page.evaluate(()=>{(window as any).__emLifecycle.mountScene();});await page.waitForFunction(()=>(window as any).__emLifecycle.status().ready,{},{timeout:90000});
 expect(await page.evaluate(()=>(window as any).__emLifecycle.capture())).toBeGreaterThan(100);
 const before=await page.evaluate(()=>(window as any).__emLifecycle.status());console.log('modular renderer initial',JSON.stringify(before.data));
 await page.evaluate(()=>{(window as any).__emLifecycle.disposeScene();});await page.waitForTimeout(100);
 const after=await page.evaluate(()=>(window as any).__emLifecycle.status());expect(after.canvases).toBe(0);expect(after.pendingFrames).toBe(0);expect(Object.values(after.counts).every(n=>n===1)).toBe(true);
 expect(after.renderers.every((r:any)=>r.geometries===0&&r.textures===0)).toBe(true);
 // New mount torn down before async model loading completes must stay silent.
 await page.evaluate(()=>{(window as any).__emLifecycle.mountScene();(window as any).__emLifecycle.disposeScene();});await page.waitForLoadState('networkidle');await page.waitForTimeout(500);
 const final=await page.evaluate(()=>(window as any).__emLifecycle.status());expect(final.canvases).toBe(0);expect(final.pendingFrames).toBe(0);expect(final.callbacks.ready).toEqual([true]);expect(final.callbacks.fallback).toEqual([]);expect(errors).toEqual([]);
});
