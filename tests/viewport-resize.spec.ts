import { expect, test } from "@playwright/test";

test("the open settings panel batches resize notifications and ignores text-only mutations", async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind: any, ...args: any[]) {
      return /webgl/.test(kind) ? null : (getContext as any).call(this, kind, ...args);
    } as any;
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Tùy chọn", exact: true });
  await trigger.click();
  const panel = page.getByRole("dialog", { name: "Tùy chọn", exact: true });
  await expect(panel).toHaveAttribute("data-side", "right");
  const reads = await page.evaluate(async () => {
    const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    await document.fonts.ready;
    for (let i = 0; i < 3; i++) await nextFrame();
    const toolbar = document.querySelector<HTMLElement>(".minimal-bar")!;
    const getRect = toolbar.getBoundingClientRect;
    let reads = 0;
    toolbar.getBoundingClientRect = function () { reads++; return getRect.call(this); };
    const label = document.querySelector(".popover-options h2")!;
    label.firstChild!.textContent = "Tùy chọn ";
    await nextFrame();
    await nextFrame();
    const afterText = reads;
    for (let i = 0; i < 12; i++) {
      window.dispatchEvent(new Event("resize"));
      visualViewport!.dispatchEvent(new Event("resize"));
    }
    await nextFrame();
    await nextFrame();
    toolbar.getBoundingClientRect = getRect;
    return { afterText, total: reads };
  });
  expect(reads).toEqual({ afterText: 0, total: 1 });

  await page.setViewportSize({ width: 900, height: 425 });
  await expect(panel).toHaveAttribute("data-side", "above");
  await expect.poll(() => panel.evaluate(element => {
    const rect = element.getBoundingClientRect();
    return rect.left >= 11 && rect.top >= 11 && rect.right <= innerWidth - 11 &&
      rect.bottom <= innerHeight - 11 && element.scrollHeight > element.clientHeight;
  })).toBe(true);
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});

test("WebGL applies one settled resize, tracks DPR and resumes the same playing session", async ({ page }) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 860, height: 540 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install();
  await page.goto("/?qa=1&render=both");
  const host = page.locator(".canvas-host");
  await expect(host).toHaveAttribute("data-model-source", "/assets/sheep.glb", { timeout: 90000 });
  await expect(host).toHaveAttribute("data-render-mode", "both");
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  const cdp = await page.context().newCDPSession(page);
  const setMetrics = (width: number, height: number, deviceScaleFactor = 1) =>
    cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor, mobile: false });
  await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(".canvas-host canvas")!;
    canvas.dataset.bufferUpdates = "0";
    new MutationObserver(mutations => {
      canvas.dataset.bufferUpdates = String(Number(canvas.dataset.bufferUpdates) + mutations.length);
    }).observe(canvas, { attributes: true, attributeFilter: ["width"] });
  });
  const stats = () => page.evaluate(() => {
    const host = document.querySelector<HTMLElement>(".canvas-host")!;
    const canvas = host.querySelector("canvas")!;
    const app = document.querySelector<HTMLElement>("main")!;
    return {
      frames: Number(host.dataset.renderedFrames), width: canvas.width, height: canvas.height,
      cssWidth: canvas.clientWidth, cssHeight: canvas.clientHeight, phase: Number(host.dataset.sceneTime),
      activeSeconds: (window as any).__emQA.activeSeconds as number,
      remaining: Number(app.dataset.remaining), playing: app.dataset.playing,
      bufferUpdates: Number(canvas.dataset.bufferUpdates),
    };
  });
  const baseline = await stats();
  expect(baseline.width).toBe(774);
  for (let step = 1; step <= 15; step++) {
    await setMetrics(860 + step * 4, 540 - step * 4);
    await expect.poll(async () => (await stats()).cssWidth).toBe(860 + step * 4);
    // Replay the window notification before advancing the virtual drag clock.
    // This keeps event spacing deterministic on software WebGL in CI.
    await page.evaluate(() => window.dispatchEvent(new Event("resize")));
    await page.clock.runFor(32);
  }
  expect(await stats()).toMatchObject({ cssWidth: 920, cssHeight: 480, width: baseline.width, frames: baseline.frames, bufferUpdates: 0 });
  await page.clock.runFor(200);
  expect(await stats()).toMatchObject({ width: 828, height: 432, frames: baseline.frames + 1, phase: baseline.phase, bufferUpdates: 1 });
  await page.clock.resume();
  await page.waitForTimeout(350);
  expect((await stats()).frames).toBe(baseline.frames + 1);

  await setMetrics(920, 480, 1.25);
  await expect.poll(() => page.evaluate(() => devicePixelRatio)).toBe(1.25);
  await expect.poll(stats).toMatchObject({ width: 1035, height: 540, frames: baseline.frames + 2, bufferUpdates: 2 });

  const options = page.getByRole("button", { name: "Tùy chọn", exact: true });
  await options.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  await page.getByRole("button", { name: "Bắt đầu thư giãn", exact: true }).press("Enter");
  await expect(page.locator("main")).toHaveAttribute("data-playing", "true");
  await page.clock.runFor(20);
  const started = await stats();
  for (const [width, height] of [[912, 466], [904, 450], [900, 425]]) {
    await setMetrics(width, height, 1.25);
    await expect.poll(async () => (await stats()).cssWidth).toBe(width);
    await page.evaluate(() => window.dispatchEvent(new Event("resize")));
    await page.clock.runFor(32);
  }
  expect((await stats()).bufferUpdates).toBe(started.bufferUpdates);
  await page.clock.fastForward(500);
  await page.clock.runFor(35);
  const settled = await stats();
  expect(settled).toMatchObject({ width: 1012, height: 478, playing: "true", bufferUpdates: started.bufferUpdates + 1 });
  expect(settled.activeSeconds).toBeGreaterThanOrEqual(started.activeSeconds + 0.5);
  expect(settled.remaining).toBeLessThan(started.remaining);
  expect(settled.remaining).toBeGreaterThan(0);
  await expect(page.getByRole("dialog")).toHaveAttribute("data-side", "above");
  await page.getByRole("button", { name: "Mặt cừu của bạn", exact: true }).press("Enter");
  await expect(host).toHaveAttribute("data-scene-obscured", "true");
  const beforeEditor = await stats();
  await page.clock.fastForward(2500);
  const inEditor = await stats();
  expect(inEditor).toMatchObject({ frames: beforeEditor.frames, activeSeconds: beforeEditor.activeSeconds, playing: "true" });
  expect(inEditor.remaining).toBeLessThan(beforeEditor.remaining - 2000);
  await page.keyboard.press("Escape");
  await expect(options).toBeFocused();
  await page.clock.runFor(35);
  expect((await stats()).activeSeconds).toBeGreaterThanOrEqual(beforeEditor.activeSeconds + 2.5);
});
