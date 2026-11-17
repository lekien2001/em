import { test, expect } from "@playwright/test";
import { buildLifecycleHarness } from "./support/build-lifecycle-harness";
test.beforeAll(buildLifecycleHarness);
async function fallback(page: any) {
  await page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      type: any,
      ...args: any[]
    ) {
      return /webgl/.test(type) ? null : (get as any).call(this, type, ...args);
    } as any;
  });
}

test("latest sound, volume and duration chosen during preparation are used on successful start", async ({
  page,
}) => {
  await fallback(page);
  await page.addInitScript(() => {
    const post = Worker.prototype.postMessage;
    let released=false;
    const pending:{worker:Worker;message:unknown;rest:unknown[]}[]=[];
    Worker.prototype.postMessage=function(message,...rest){if(released)post.call(this,message,...(rest as [any]));else pending.push({worker:this,message,rest});};
    Object.assign(window,{__releaseAudioPreparation(){released=true;for(const item of pending.splice(0))post.call(item.worker,item.message,...(item.rest as [any]));}});
  });
  await page.goto("/lifecycle-qa.html");
  await page.evaluate(() => (window as any).__emLifecycle.mountApp());
  await page
    .getByRole("button", { name: "Bắt đầu thư giãn", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Đang mở âm thanh", exact: true }),
  ).toBeVisible();
  await expect(page.locator('.play-loading')).toBeVisible();
  await expect(page.getByRole('button',{name:'Đang mở âm thanh',exact:true})).toHaveAttribute('aria-busy','true');
  await expect(page.getByRole('button',{name:'Đang mở âm thanh',exact:true})).toHaveAttribute('title','Đang mở âm thanh');
  await page.getByRole("button", { name: /^Chọn âm thanh/ }).click();
  await page.getByRole("button", { name: /^Tiếng suối/ }).click();
  await page.getByRole("button", { name: /^Hẹn giờ:/ }).click();
  await page.getByRole("button", { name: "15 phút", exact: true }).click();
  await page.getByRole("button", { name: "Âm lượng", exact: true }).click();
  await page.getByRole("slider", { name: "Âm lượng", exact: true }).focus();
  await page.keyboard.press("End");
  await page.keyboard.press("Escape");
  await expect(page.locator("main")).toHaveAttribute("data-playing", "false");
  await page.evaluate(()=>(window as any).__releaseAudioPreparation());
  await expect(page.locator("main")).toHaveAttribute("data-playing", "true");
  await expect(page.locator('.play-loading')).toHaveCount(0);
  expect(
    Number(await page.locator("main").getAttribute("data-remaining")),
  ).toBeLessThanOrEqual(900000);
  expect(
    Number(await page.locator("main").getAttribute("data-remaining")),
  ).toBeGreaterThan(890000);
  await expect(page.locator(".minimal-sound")).toContainText("Tiếng suối");
  const state = await page.evaluate(() =>
    (window as any).__emLifecycle.status(),
  );
  expect(state.audio.activeSound).toBe("stream");
  expect(state.envelopes[0].volume).toBe(1);
  expect(state.envelopes[0].remaining).toBe(900000);
});

test("failed buffer preparation keeps the session paused and offers retry", async ({
  page,
}) => {
  await fallback(page);
  await page.addInitScript(() => {
    const create = AudioContext.prototype.createBuffer;
    AudioContext.prototype.createBuffer = function (channels, length, rate) {
      if (length > rate * 30) throw new Error("Buffer unavailable");
      return create.call(this, channels, length, rate);
    };
  });
  await page.goto("/lifecycle-qa.html");
  await page.evaluate(() => (window as any).__emLifecycle.mountApp());
  await page
    .getByRole("button", { name: "Bắt đầu thư giãn", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Chưa thể phát âm thanh");
  await expect(page.locator("main")).toHaveAttribute("data-playing", "false");
  await expect(page.locator("main")).toHaveAttribute(
    "data-remaining",
    "1800000",
  );
  await expect(
    page.getByRole("button", { name: "Thử lại", exact: true }),
  ).toBeVisible();
});

for (const minutes of [30, 60])
  test(`deadline ${minutes} minutes expires by wall clock even when audio clock differs`, async ({
    page,
  }) => {
    await fallback(page);
    await page.clock.install({time:new Date("2026-01-01T00:00:00Z")});
    await page.clock.pauseAt(new Date("2026-01-01T00:01:00Z"));
    await page.goto("/lifecycle-qa.html");
    await page.evaluate(() => (window as any).__emLifecycle.mountApp());
    await page.getByRole("button", { name: /^Hẹn giờ:/ }).click();
    await page
      .getByRole("button", { name: `${minutes} phút`, exact: true })
      .click();
    await page
      .getByRole("button", { name: "Bắt đầu thư giãn", exact: true })
      .click();
    await expect(page.locator("main")).toHaveAttribute("data-playing", "true");
    await page.clock.setSystemTime(
      await page.evaluate(
        () =>
          Date.now() +
          (Number(
            document.querySelector("main")!.getAttribute("data-remaining"),
          ) -
            14000),
      ),
    );
    await page.evaluate(() =>
      document.dispatchEvent(new Event("visibilitychange")),
    );
    await page.clock.runFor(20);
    await expect
      .poll(async () =>
        Number(await page.locator("main").getAttribute("data-fade")),
      )
      .toBeLessThan(1);
    await page.clock.setSystemTime(
      await page.evaluate(() => Date.now() + 15000),
    );
    await page.evaluate(() =>
      document.dispatchEvent(new Event("visibilitychange")),
    );
    await page.clock.runFor(20);
    await expect(page.locator("main")).toHaveAttribute("data-playing", "false");
    await expect(page.locator("main")).toHaveAttribute("data-remaining", "0");
    await expect(page.locator("main")).toHaveAttribute("data-fade", "0.000");
  });


test("final fade resynchronizes native audio when wall and audio clocks diverge", async ({page}) => {
 await fallback(page);await page.clock.install({time:new Date("2026-01-01T00:00:00Z")});await page.clock.pauseAt(new Date("2026-01-01T00:01:00Z"));await page.goto("/lifecycle-qa.html");await page.evaluate(()=>(window as any).__emLifecycle.mountApp());await page.getByRole("button",{name:"Bắt đầu thư giãn",exact:true}).click();await expect(page.locator("main")).toHaveAttribute("data-playing","true");
 await page.clock.setSystemTime(await page.evaluate(()=>Date.now()+1790000));await page.clock.runFor(250);
 const state=await page.evaluate(()=>(window as any).__emLifecycle.status());expect(state.envelopes.at(-1).remaining).toBeLessThanOrEqual(10000);expect(state.audio.audioTime).toBeLessThan(30);
 await expect.poll(async()=>(await page.evaluate(()=>(window as any).__emLifecycle.status())).audio.sessionGain).toBeLessThan(.7);expect(Number(await page.locator("main").getAttribute("data-fade"))).toBeLessThan(.7);await expect(page.locator("main")).toHaveAttribute("data-playing","true");
});
