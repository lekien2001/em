import { test, expect } from "@playwright/test";
import { buildAudioHarness } from "./support/build-audio-harness";
test.beforeAll(buildAudioHarness);
const stats = (page: any) =>
  page.evaluate(() => (window as any).__audioTest.stats());
test("inline worker matches the pure DSP exactly at both supported sample rates", async ({
  page,
}) => {
  await page.goto("/audio-qa.html");
  for (const sampleRate of [44100, 48000])
    for (const sound of ["rain", "stream", "brown"]) {
      const result = await page.evaluate(
        async ({ sound, sampleRate }) =>
          (window as any).__audioTest.parity(sound, sampleRate, 12345),
        { sound, sampleRate },
      );
      expect(result.maxError).toBe(0);
      expect(result.mode).toBe("worker");
      expect(result.pending).toBe(0);
    }
});
test("native offline audio output follows equal-power transitions and final 15-second fade", async ({
  page,
}) => {
  await page.goto("/audio-qa.html");
  const curves = await page.evaluate(() =>
    (window as any).__audioTest.curves(),
  );
  for (const row of curves) expect(row.power).toBeCloseTo(0.04, 4);
  expect(curves[2].left).toBeCloseTo(0.2 / Math.sqrt(2), 4);
  expect(curves[2].right).toBeCloseTo(0.2 / Math.sqrt(2), 4);
  const envelope = await page.evaluate(() =>
    (window as any).__audioTest.envelope(),
  );
  expect(envelope[0].value).toBeCloseTo(0.6, 4);
  expect(envelope[1].value).toBeCloseTo(0.6, 4);
  expect(envelope[2].value).toBeCloseTo(0.6, 4);
  expect(envelope[3].value).toBeCloseTo(0.3, 3);
  expect(envelope[4].value).toBeLessThan(0.001);
});
test("latest selection wins, pause cancels preparation and disposal cancels worker work", async ({
  page,
}) => {
  await page.goto("/audio-qa.html");
  await page.getByText("Start rain", { exact: true }).click();
  await expect.poll(async () => (await stats(page)).activeSound).toBe("rain");
  await page.evaluate(async () => {
    const api = (window as any).__audioTest;
    await Promise.all([
      api.select("stream"),
      api.select("brown"),
      api.select("rain"),
    ]);
  });
  expect((await stats(page)).activeSound).toBe("rain");
  expect((await stats(page)).bank.cached).toBe(3);
  await page.evaluate(async () => {
    const api = (window as any).__audioTest;
    await api.select("stream");
    api.pause();
  });
  await expect.poll(async () => (await stats(page)).context).toBe("suspended");
  expect((await stats(page)).retired).toBe(0);
  expect((await stats(page)).wantedPlaying).toBe(false);
  await page.getByText("Start brown", { exact: true }).click();
  await expect.poll(async () => (await stats(page)).activeSound).toBe("brown");
  await expect.poll(async () => (await stats(page)).retired).toBe(0);
  await page.evaluate(() => (window as any).__audioTest.dispose());
  expect((await stats(page)).context).toBe("closed");
  expect((await stats(page)).voices).toBe(0);
  expect((await stats(page)).bank).toBe(null);
});
test("blocked workers use the yielding fallback and dispose cleanly while generating", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.Worker = class {
      constructor() {
        throw new Error("Worker blocked");
      }
    } as any;
  });
  await page.goto("/audio-qa.html");
  await page.getByText("Start rain", { exact: true }).click();
  await expect.poll(async () => (await stats(page)).activeSound).toBe("rain");
  expect((await stats(page)).bank.mode).toBe("fallback");
  await page.evaluate(async () => {
    const api = (window as any).__audioTest;
    const pending = api.select("stream");
    api.dispose();
    await pending;
  });
  const state = await stats(page);
  expect(state.context).toBe("closed");
  expect(state.voices).toBe(0);
  expect(state.error).toBe("");
});

test("worker messaging failure revokes its Blob URL and switches to fallback", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const Real = Worker,
      create = URL.createObjectURL.bind(URL),
      revoke = URL.revokeObjectURL.bind(URL);
    const urls = { created: 0, revoked: 0 };
    Object.assign(window, { __audioURLs: urls });
    URL.createObjectURL = (blob) => {
      urls.created++;
      return create(blob);
    };
    URL.revokeObjectURL = (url) => {
      urls.revoked++;
      return revoke(url);
    };
    window.Worker = class extends Real {
      postMessage() {
        throw new Error("Messaging blocked");
      }
    } as any;
  });
  await page.goto("/audio-qa.html");
  await page.getByText("Start rain", { exact: true }).click();
  await expect.poll(async () => (await stats(page)).activeSound).toBe("rain");
  expect((await stats(page)).bank.mode).toBe("fallback");
  expect(await page.evaluate(() => (window as any).__audioURLs)).toEqual({
    created: 1,
    revoked: 1,
  });
  await page.evaluate(() => (window as any).__audioTest.dispose());
});

test("pause prevents a prepared later sound from starting; resume uses its cached buffer", async ({
  page,
}) => {
  await page.goto("/audio-qa.html");
  await page.getByText("Start rain", { exact: true }).click();
  await expect.poll(async () => (await stats(page)).activeSound).toBe("rain");
  await page.evaluate(async () => {
    const api = (window as any).__audioTest;
    const pending = api.select("stream");
    api.pause();
    await pending;
  });
  await expect.poll(async () => (await stats(page)).context).toBe("suspended");
  const paused = await stats(page);
  expect(paused.activeSound).toBe("rain");
  expect(paused.bank.cached).toBe(2);
  expect(paused.wantedPlaying).toBe(false);
  await page.getByText("Start stream", { exact: true }).click();
  await expect.poll(async () => (await stats(page)).activeSound).toBe("stream");
  expect((await stats(page)).bank.cached).toBe(2);
  await page.evaluate(() => (window as any).__audioTest.dispose());
});

test("disposal during a pending worker request cancels it without late audio", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const post = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (message, ...rest) {
      setTimeout(() => post.call(this, message, ...(rest as [any])), 500);
    };
  });
  await page.goto("/audio-qa.html");
  await page.getByText("Start rain", { exact: true }).click();
  await expect.poll(async () => (await stats(page)).bank?.pending ?? 0).toBe(1);
  await page.evaluate(() => (window as any).__audioTest.dispose());
  await expect.poll(async () => (await stats(page)).starting).toBe(false);
  const result = await stats(page);
  expect(result.voices).toBe(0);
  expect(result.context).toBe("closed");
  expect(result.error).toBe("");
  expect(result.bank).toBe(null);
});

test("serial rapid switches finish native curves and retain at most three shared voices", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/audio-qa.html");
  await page.getByText("Start rain", { exact: true }).click();
  await expect.poll(async () => (await stats(page)).activeSound).toBe("rain");
  await page.evaluate(async () => {
    const api = (window as any).__audioTest;
    await api.select("stream");
    await api.select("brown");
    for (let i = 0; i < 12; i++) {
      await api.select(["rain", "stream", "brown"][i % 3]);
      await new Promise((resolve) => setTimeout(resolve, 15));
    }
  });
  await expect.poll(async () => (await stats(page)).retired).toBe(0);
  const result = await stats(page);
  expect(result.voices).toBe(3);
  expect(result.activeSound).toBe("brown");
  expect(result.bank.cached).toBe(3);
  expect(errors).toEqual([]);
  await page.evaluate(() => (window as any).__audioTest.dispose());
});

 test("three-layer native mix and normalized transition stay below -1 dBFS", async ({page}) => {
  await page.goto("/audio-qa.html"); const result = await page.evaluate(()=>(window as any).__audioTest.nativeMix());
  expect(result.peak).toBeLessThan(Math.pow(10,-1/20)); expect(result.samples[2]).toBeCloseTo(Math.sqrt(3)*.5,4);
  await page.getByText("Start rain",{exact:true}).click();await expect.poll(async()=>(await stats(page)).activeSound).toBe("rain");
  await page.evaluate(()=>(window as any).__audioTest.mix({rain:{enabled:true,level:1},stream:{enabled:true,level:1},brown:{enabled:true,level:1}}));
  await page.waitForTimeout(200); const state=await stats(page);expect(state.activeSounds).toEqual(["rain","stream","brown"]);expect(state.voices).toBe(3);expect(Math.hypot(...state.levels)).toBeCloseTo(1,4);
  await page.evaluate(()=>(window as any).__audioTest.dispose());
 });

 test("configured native fades use 15, 60 and 180 seconds and recover continuously", async({page})=>{
  await page.goto("/audio-qa.html");for(const seconds of [15,60,180]){const values=await page.evaluate(seconds=>(window as any).__audioTest.configuredFade(seconds),seconds);expect(values[1]).toBeCloseTo(.8*3/seconds,4);expect(values[3]).toBeCloseTo(.8*2/seconds,4);expect(values[4]).toBeLessThan(.001);}
  const recovered=await page.evaluate(()=>(window as any).__audioTest.configuredFade(15,true));expect(recovered[0]).toBeCloseTo(.8*.55,4);expect(recovered[2]).toBeCloseTo(.8,4);expect(recovered[5]).toBeCloseTo(.8*14/15,4);
 });
