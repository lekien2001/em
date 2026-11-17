// One real WebGL scene for ten wall-clock minutes; no simulated clocks or FPS claim.
import { chromium, expect as baseExpect } from '@playwright/test';
import { build } from 'esbuild';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const expect = baseExpect.configure({ timeout: 60000 });
await build({ entryPoints: ['tests/support/lifecycle-harness.tsx'], bundle: true, minify: true, target: 'es2022', define: { 'process.env.NODE_ENV': '"production"' }, format: 'iife', outfile: 'dist/soak-qa.js' });
await writeFile('dist/soak-qa.html', '<!doctype html><html lang="vi"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><link rel="stylesheet" href="/style.css"></head><body><div id="root" class="app"></div><script src="/soak-qa.js"></script></body></html>');
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-precise-memory-info'] });
const report = { clock: 'real wall time and AudioContext.currentTime', renderer: 'SwiftShader: stability check, not a hardware FPS benchmark', appSha256: createHash('sha256').update(await readFile('dist/em.js')).digest('hex'), samples: [], errors: [], completed: false };
try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  page.setDefaultTimeout(120000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
  await page.goto('http://127.0.0.1:4173/soak-qa.html?qa=1');
  await page.evaluate(() => window.__emLifecycle.mountApp());
  await expect(page.locator('.canvas-host')).toHaveAttribute('data-model-source', '/assets/sheep.glb');
  await page.evaluate(() => document.fonts.ready);
  console.log('WebGL and fonts ready. Configure three layers before playback.');
  // Keyboard navigation intentionally keeps controls visible while operating them.
  async function activate(locator) { await locator.focus(); await page.keyboard.press('Enter'); }
  async function openLibrary() {
    await page.keyboard.press('Tab');
    await expect(page.locator('main')).not.toHaveClass(/is-immersed/);
    await activate(page.getByRole('button', { name: /^Chọn âm thanh/ }));
    await expect(page.getByRole('dialog', { name: 'Âm thanh', exact: true })).toBeVisible();
  }
  async function mixAll() {
    await openLibrary();
    await activate(page.getByRole('tab', { name: 'Trộn', exact: true }));
    for (const name of ['Mưa nhẹ', 'Tiếng suối', 'Brown noise']) {
      const control = page.getByRole('switch', { name, exact: true });
      if (await control.getAttribute('aria-checked') === 'false') await activate(control);
    }
    await page.keyboard.press('Escape');
  }
  async function choose(name) {
    await openLibrary();
    await activate(page.getByRole('tab', { name: 'Chọn nhanh', exact: true }));
    await activate(page.getByRole('button', { name, exact: true }));
  }
  await mixAll();
  await activate(page.getByRole('button', { name: 'Bắt đầu thư giãn', exact: true }));
  await expect(page.locator('main')).toHaveAttribute('data-playing', 'true');
  await expect.poll(() => page.evaluate(() => window.__emLifecycle.status().audio.activeSounds.length)).toBe(3);
  console.log('Three layers ready; starting 600 real seconds.');
  const started = Date.now(), audioStart = await page.evaluate(() => window.__emLifecycle.status().audio.audioTime);
  report.remainingStart = Number(await page.locator('main').getAttribute('data-remaining'));
  let next = 0, index = 0;
  while (Date.now() - started < 600000) {
    if (Date.now() - started >= next) {
      const sample = await page.evaluate(() => ({ audio: window.__emLifecycle.status().audio, heap: performance.memory?.usedJSHeapSize ?? null, data: { ...document.querySelector('.canvas-host').dataset }, playing: document.querySelector('main').dataset.playing, remaining: Number(document.querySelector('main').dataset.remaining) }));
      sample.elapsedSeconds = (Date.now() - started) / 1000; report.samples.push(sample); console.log(JSON.stringify(sample));
      expect(sample.playing).toBe('true'); expect(sample.audio.context).toBe('running');
      expect(sample.audio.bank.cached).toBe(3); expect(sample.audio.bank.pending).toBe(0); expect(sample.audio.voices).toBe(3); expect(sample.audio.retired).toBe(0);
      expect(Math.hypot(...sample.audio.levels)).toBeLessThanOrEqual(1.00001);
      if (index++ > 0) {
        if (index % 2) { await mixAll(); await expect.poll(() => page.evaluate(() => window.__emLifecycle.status().audio.activeSounds.length)).toBe(3); }
        else await choose(['Mưa nhẹ', 'Tiếng suối', 'Brown noise'][index % 3]);
      }
      next += 30000;
    }
    await page.waitForTimeout(Math.max(1, Math.min(10000, 600000 - (Date.now() - started))));
  }
  report.elapsedSeconds = (Date.now() - started) / 1000;
  report.audioElapsedSeconds = await page.evaluate(() => window.__emLifecycle.status().audio.audioTime) - audioStart;
  report.audioClockDriftSeconds = report.audioElapsedSeconds - report.elapsedSeconds;
  report.audioClockNote = 'Headless native AudioContext also runs slower than wall time in an independent silent-buffer probe. Deadline uses Date.now, not this device clock.';
  for (let i = 1; i < report.samples.length; i++) expect(report.samples[i].audio.audioTime).toBeGreaterThan(report.samples[i - 1].audio.audioTime);
  report.remainingEnd = Number(await page.locator('main').getAttribute('data-remaining'));
  report.deadlineDriftMs = report.remainingStart - report.remainingEnd - report.elapsedSeconds * 1000;
  expect(report.elapsedSeconds).toBeGreaterThanOrEqual(600);
  await page.keyboard.press('Tab');
  await activate(page.getByRole('button', { name: 'Tạm dừng phiên thư giãn', exact: true }));
  await expect(page.locator('main')).toHaveAttribute('data-playing', 'false');
  await expect.poll(() => page.evaluate(() => window.__emLifecycle.status().audio.context)).toBe('suspended');
  await page.evaluate(() => window.__emLifecycle.unmountApp());
  report.final = await page.evaluate(() => window.__emLifecycle.status());
  expect(report.final.audio.context).toBe('closed'); expect(report.final.audio.voices).toBe(0); expect(report.final.audio.bank).toBe(null); expect(report.errors).toEqual([]);
  report.heapRangeBytes = { min: Math.min(...report.samples.map(s => s.heap)), max: Math.max(...report.samples.map(s => s.heap)) };
  report.completed = true;
} catch (error) { report.failure = String(error); throw error; }
finally { await mkdir('artifacts', { recursive: true }); await writeFile('artifacts/audio-soak.json', JSON.stringify(report, null, 2)); await browser.close(); }
