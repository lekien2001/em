import { expect, test, type Page } from "@playwright/test";
import { getRecording } from "../src/audio/catalog";
import { singleMix, type MixConfig } from "../src/session/config";
import type { RecordingId } from "../src/types";
import { buildAudioHarness } from "./support/build-audio-harness";

test.beforeAll(buildAudioHarness);

const origin = "https://raw.githubusercontent.com/lekien2001/storage/";
const stats = (page: Page) => page.evaluate(() => (window as any).__audioTest.stats());

function testWave() {
  const rate = 8000;
  const samples = 121 * rate;
  const wav = Buffer.alloc(44 + samples * 2);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24);
  wav.writeUInt32LE(rate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) wav.writeInt16LE(Math.round(1500 * Math.sin(440 * Math.PI * i / rate)), 44 + i * 2);
  return wav;
}

async function captureDecks(page: Page) {
  await page.addInitScript(() => {
    const NativeAudio = window.Audio;
    const decks: HTMLAudioElement[] = [];
    (window as any).__decks = decks;
    window.Audio = function (src?: string) {
      const audio = new NativeAudio(src);
      decks.push(audio);
      return audio;
    } as typeof Audio;
  });
}

async function serveWave(page: Page, fail = () => false) {
  const wav = testWave();
  let requests = 0;
  await page.route(`${origin}**`, async route => {
    requests++;
    if (fail()) { await route.abort(); return; }
    const headers: Record<string, string> = {
      "access-control-allow-origin": "*", "accept-ranges": "bytes", "content-type": "audio/wav",
    };
    const match = /^bytes=(\d+)-(\d*)$/.exec(route.request().headers().range ?? "");
    if (!match) { await route.fulfill({ status: 200, headers, body: wav }); return; }
    const first = Number(match[1]);
    const last = match[2] ? Math.min(Number(match[2]), wav.length - 1) : wav.length - 1;
    headers["content-range"] = `bytes ${first}-${last}/${wav.length}`;
    await route.fulfill({ status: 206, headers, body: wav.subarray(first, last + 1) });
  });
  return () => requests;
}

async function holdRecording(page: Page, id: RecordingId) {
  let release!: (allow: boolean) => void;
  let held = true;
  const decision = new Promise<boolean>(resolve => { release = resolve; });
  const url = getRecording(id).url;
  await page.route(url, async route => {
    try {
      if (held && !await decision) await route.abort();
      else await route.fallback();
    } catch { /* The browser may already have cancelled the request. */ }
  });
  return {
    release(allow = true) { release(allow); held = false; },
    url,
  };
}

async function appWithMix(page: Page, mix: MixConfig) {
  await page.addInitScript(config => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return type.includes("webgl") ? null : (getContext as Function).call(this, type, ...args);
    } as typeof getContext;
    localStorage.setItem("em:mix-v1", JSON.stringify(config));
  }, mix);
  await page.goto("/");
}

async function openMixer(page: Page) {
  await page.getByRole("button", { name: /^Chọn âm thanh/ }).click();
  await page.getByRole("tab", { name: "Trộn", exact: true }).click();
}

const begin = (page: Page) => page.getByRole("button", { name: "Bắt đầu thư giãn", exact: true });
const channelStatus = (page: Page, sound: string, status: string) =>
  page.getByRole("status", { name: `${sound}: ${status}`, exact: true });

test("the session starts with a ready channel while a stalled recording can be retried alone", async ({ page }) => {
  await captureDecks(page);
  const requests = await serveWave(page);
  const held = await holdRecording(page, "rain-window");
  const mix = singleMix("rain");
  mix["rain-window"].enabled = true;
  await appWithMix(page, mix);
  await openMixer(page);
  try {
    const blocked = page.waitForRequest(held.url);
    await begin(page).click();
    await blocked;
    await expect(page.locator("main")).toHaveAttribute("data-playing", "true", { timeout: 3000 });
    await expect(channelStatus(page, "Mưa nhẹ", "Đang phát")).toBeVisible();
    await expect(channelStatus(page, "Mưa bên cửa sổ", "Đang tải")).toBeVisible();
    expect(requests()).toBe(0);
    const remaining = Number(await page.locator("main").getAttribute("data-remaining"));
    held.release(false);
    await expect(channelStatus(page, "Mưa bên cửa sổ", "Chưa phát được")).toBeVisible();
    await page.getByRole("button", { name: "Thử lại Mưa bên cửa sổ", exact: true }).click();
    await expect(channelStatus(page, "Mưa bên cửa sổ", "Đang phát")).toBeVisible();
    await expect(channelStatus(page, "Mưa nhẹ", "Đang phát")).toBeVisible();
    expect(Number(await page.locator("main").getAttribute("data-remaining"))).toBeLessThanOrEqual(remaining);
    expect(requests()).toBeGreaterThan(0);
  } finally { held.release(); }
});

test("a slow solo recording uses temporary rain and takes over without resetting the timer", async ({ page }) => {
  await serveWave(page);
  const held = await holdRecording(page, "mouth-asmr");
  await appWithMix(page, singleMix("mouth-asmr"));
  await openMixer(page);
  try {
    await begin(page).click();
    await expect(page.getByRole("button", { name: "Hủy mở âm thanh" })).toBeEnabled();
    await expect(page.locator("main")).toHaveAttribute("data-playing", "false");
    const fallback = page.getByRole("status").filter({ hasText: "Đang phát Mưa nhẹ tổng hợp." });
    await expect(fallback).toBeVisible({ timeout: 3000 });
    await expect(channelStatus(page, "Âm miệng ASMR", "Đang tải")).toBeVisible();
    await expect(page.locator("main")).toHaveAttribute("data-playing", "true");
    const remaining = Number(await page.locator("main").getAttribute("data-remaining"));
    held.release();
    await expect(channelStatus(page, "Âm miệng ASMR", "Đang phát")).toBeVisible();
    await expect(fallback).toHaveCount(0);
    expect(Number(await page.locator("main").getAttribute("data-remaining"))).toBeLessThanOrEqual(remaining);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("em:mix-v1")!).rain.enabled)).toBe(false);
  } finally { held.release(); }
});

test("cancelling startup or pausing an active mix discards held audio", async ({ page }) => {
  await captureDecks(page);
  await serveWave(page);
  await page.clock.install();
  const held = await holdRecording(page, "rain-window");
  await appWithMix(page, singleMix("rain-window"));
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 50));
  try {
    const blocked = page.waitForRequest(held.url);
    await begin(page).click();
    await blocked;
    await page.getByRole("button", { name: "Hủy mở âm thanh", exact: true }).click();
    await page.clock.fastForward(6000);
    await expect(begin(page)).toBeEnabled();
    await expect(page.locator("main")).toHaveAttribute("data-playing", "false");
    await expect(page.locator("main")).toHaveAttribute("data-remaining", "1800000");
    await openMixer(page);
    await page.getByRole("switch", { name: "Mưa nhẹ", exact: true }).click();
    await begin(page).click();
    await expect(channelStatus(page, "Mưa nhẹ", "Đang phát")).toBeVisible();
    await expect(channelStatus(page, "Mưa bên cửa sổ", "Đang tải")).toBeVisible();
    await page.getByRole("button", { name: "Tạm dừng phiên thư giãn", exact: true }).click();
    held.release();
    await page.clock.fastForward(6000);
    await expect(page.locator("main")).toHaveAttribute("data-playing", "false");
    await expect(channelStatus(page, "Mưa bên cửa sổ", "Đang phát")).toHaveCount(0);
    expect(await page.evaluate(() => (window as any).__decks.every((audio: HTMLAudioElement) => !audio.hasAttribute("src")))).toBe(true);
  } finally { held.release(); }
});

test("a recording that finishes loading after the deadline does not join the session", async ({ page }) => {
  await captureDecks(page);
  await serveWave(page);
  await page.clock.install();
  const held = await holdRecording(page, "lego-asmr");
  const mix = singleMix("rain");
  mix["lego-asmr"].enabled = true;
  await appWithMix(page, mix);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 50));
  try {
    await openMixer(page);
    await begin(page).click();
    await expect(page.locator("main")).toHaveAttribute("data-playing", "true");
    await expect(channelStatus(page, "Lục hộp LEGO", "Đang tải")).toBeVisible();
    const endTime = await page.evaluate(() => Date.now() + 1800001);
    await page.clock.setSystemTime(endTime);
    held.release();
    await expect.poll(() => page.evaluate(() => (window as any).__decks.some((audio: HTMLAudioElement) => audio.currentTime > .75))).toBe(true);
    await expect(channelStatus(page, "Lục hộp LEGO", "Đang phát")).toHaveCount(0);
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await expect(page.locator("main")).toHaveAttribute("data-playing", "false");
    await expect(page.locator("main")).toHaveAttribute("data-remaining", "0");
    expect(await page.evaluate(() => (window as any).__decks.every((audio: HTMLAudioElement) => !audio.hasAttribute("src")))).toBe(true);
  } finally { held.release(); }
});

test("native streaming loops with two decks and pause stops both near the seam", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await captureDecks(page);
  const requests = await serveWave(page);
  await page.goto("/audio-qa.html");
  expect(requests()).toBe(0);
  const id = "rain-window";
  const info = getRecording(id);
  await page.getByRole("button", { name: `Start ${id}` }).click();
  await expect.poll(async () => (await stats(page)).activeSound).toBe(id);
  const nearSeam = () => page.evaluate(end => {
    const deck = (window as any).__decks.find((audio: HTMLAudioElement) => !audio.paused);
    deck.currentTime = end - 2.15;
  }, info.end);

  await nearSeam();
  await expect.poll(async () => (await stats(page)).recordings[id]?.overlaps).toBe(1);
  await nearSeam();
  await expect.poll(async () => (await stats(page)).recordings[id]?.overlapping).toBe(true);
  await page.evaluate(() => (window as any).__audioTest.pause());
  await expect.poll(async () => (await stats(page)).context).toBe("suspended");
  expect(await page.evaluate(() => (window as any).__decks.every((audio: HTMLAudioElement) => audio.paused))).toBe(true);
  expect((await stats(page)).recordings[id].elements).toBe(1);

  await page.getByRole("button", { name: `Start ${id}` }).click();
  await expect.poll(async () => (await stats(page)).recordings[id]?.running).toBe(true);
  await page.evaluate(() => (window as any).__audioTest.select("stream"));
  await expect.poll(async () => (await stats(page)).recordings[id]).toBeUndefined();
  expect(await page.evaluate(() => (window as any).__decks.every((audio: HTMLAudioElement) => !audio.hasAttribute("src")))).toBe(true);
  expect(errors).toEqual([]);
});

test("a rejected standby uses the trimmed single-deck loop", async ({ page }) => {
  await captureDecks(page);
  let blockStandby = false;
  await serveWave(page, () => blockStandby);
  await page.goto("/audio-qa.html");
  await page.getByRole("button", { name: "Start lego-asmr" }).click();
  await expect.poll(async () => (await stats(page)).activeSound).toBe("lego-asmr");
  // A standby can be denied playback even with a warm cache.
  await page.evaluate(end => {
    const [first] = (window as any).__decks;
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      return this === first ? play.call(this) : Promise.reject(new DOMException("Denied", "NotAllowedError"));
    };
    first.currentTime = end - 1.5;
  }, getRecording("lego-asmr").end);
  blockStandby = true;
  await expect.poll(async () => (await stats(page)).recordings["lego-asmr"]?.seeks).toBe(1);
  const state = await stats(page);
  expect(state.recordings["lego-asmr"].position).toBeGreaterThanOrEqual(.7);
  expect(state.recordings["lego-asmr"].position).toBeLessThan(2);
  expect(state.activeSound).toBe("lego-asmr");
});

test("missing recordings keep other channels, stay selected offline and retry explicitly", async ({ page }) => {
  await captureDecks(page);
  let offline = true;
  await serveWave(page, () => offline);
  await page.goto("/audio-qa.html");
  await page.getByRole("button", { name: "Start mouth-asmr" }).click();
  await expect.poll(async () => (await stats(page)).activeSounds).toEqual(["rain"]);
  expect((await stats(page)).unavailable).toEqual(["mouth-asmr"]);
  const mix = singleMix("stream");
  mix["mouth-asmr"].enabled = true;
  await page.evaluate(mix => (window as any).__audioTest.mix(mix), mix);
  expect((await stats(page)).activeSounds).toEqual(["stream"]);
  offline = false;
  await page.evaluate(() => (window as any).__audioTest.select("mouth-asmr"));
  await expect.poll(async () => (await stats(page)).activeSound).toBe("mouth-asmr");
  expect((await stats(page)).unavailable).toEqual([]);

  await page.evaluate(() => (window as any).__decks.find((audio: HTMLAudioElement) => !audio.paused).pause());
  await expect.poll(async () => (await stats(page)).activeSound, { timeout: 9000 }).toBe("rain");
  expect((await stats(page)).wantedPlaying).toBe(true);
});

test("six live channels mix and volume fades on the same Web Audio clock", async ({ page }) => {
  await serveWave(page);
  await page.goto("/audio-qa.html");
  await page.getByRole("button", { name: "Start rain", exact: true }).click();
  await expect.poll(async () => (await stats(page)).activeSound).toBe("rain");
  const mix = singleMix("rain");
  for (const layer of Object.values(mix)) { layer.enabled = true; layer.level = 1; }
  await page.evaluate(mix => (window as any).__audioTest.mix(mix), mix);
  await expect.poll(async () => (await stats(page)).activeSounds.length).toBe(6);
  await page.evaluate(() => (window as any).__audioTest.fade(350));
  await expect.poll(async () => (await stats(page)).sessionGain).toBeLessThan(.001);
  const status = await stats(page);
  expect(status.voices).toBe(6);
  expect(status.levels.reduce((sum: number, level: number) => sum + level, 0)).toBeCloseTo(Math.sqrt(3), 4);
  await page.evaluate(() => (window as any).__audioTest.dispose());
  expect((await stats(page)).recordings).toEqual({});
});

test("a slow superseded recording is cancelled without affecting the latest blend", async ({ page }) => {
  await captureDecks(page);
  await serveWave(page);
  const blockedUrl = getRecording("rain-window").url;
  let releaseRequest: (() => void) | undefined;
  await page.route(blockedUrl, async route => {
    await new Promise<void>(resolve => { releaseRequest = resolve; });
    await route.abort().catch(() => {});
  });
  await page.goto("/audio-qa.html");
  await page.getByRole("button", { name: "Start rain", exact: true }).click();
  await expect.poll(async () => (await stats(page)).activeSound).toBe("rain");
  try {
    await page.evaluate(() => { void (window as any).__audioTest.select("rain-window"); });
    await expect.poll(() => !!releaseRequest).toBe(true);
    expect((await stats(page)).activeSound).toBe("rain");
    await page.evaluate(() => (window as any).__audioTest.select("lego-asmr"));
    await expect.poll(async () => (await stats(page)).activeSound).toBe("lego-asmr");
    expect((await stats(page)).recordings["rain-window"]).toBeUndefined();
    expect((await stats(page)).unavailable).toEqual([]);
  } finally { releaseRequest?.(); }
});
