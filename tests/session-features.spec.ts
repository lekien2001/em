import { test, expect, type Page } from "@playwright/test";
import { buildLifecycleHarness } from "./support/build-lifecycle-harness";
test.beforeAll(buildLifecycleHarness);
async function load(page: Page, clock = false) {
  await page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind: any, ...args: any[]) {
      return /webgl/.test(kind) ? null : (get as any).call(this, kind, ...args);
    } as any;
  });
  if (clock) {
    await page.clock.install({
      time: new Date("2026-01-01T00:00:00Z")
    });
    await page.clock.pauseAt(new Date("2026-01-01T00:01:00Z"));
  }
  await page.goto("/lifecycle-qa.html");
  await page.evaluate(() => (window as any).__emLifecycle.mountApp());
}
const button = (page: Page, name: string) => page.getByRole("button", {
  name,
  exact: true
});
async function favorites(page: Page) {
  await button(page, "Tùy chọn").click();
  await button(page, "Phiên yêu thích").click();
}
async function mixer(page: Page) {
  await page.getByRole("button", {
    name: /^Chọn âm thanh/
  }).click();
  await page.getByRole("tab", {
    name: "Trộn",
    exact: true
  }).click();
}
async function custom(page: Page, minutes: string) {
  await page.getByRole("button", {
    name: /^Hẹn giờ:/
  }).click();
  await page.getByLabel("Số phút tùy chỉnh", {
    exact: true
  }).fill(minutes);
  await button(page, "Áp dụng").click();
}
test("mixer retains levels, one source minimum, persists without autoplay and toggling tabs does not select", async ({
  page
}) => {
  await load(page);
  await mixer(page);
  const rain = page.getByRole("switch", {
    name: "Mưa nhẹ",
    exact: true
  });
  expect(await rain.isDisabled()).toBe(true);
  await page.getByRole("switch", {
    name: "Tiếng suối",
    exact: true
  }).click();
  await page.getByRole("slider", {
    name: "Mức tiếng suối",
    exact: true
  }).fill("0.63");
  await page.getByRole("switch", {
    name: "Tiếng suối",
    exact: true
  }).click();
  await page.getByRole("switch", {
    name: "Tiếng suối",
    exact: true
  }).click();
  await expect(page.getByRole("slider", {
    name: "Mức tiếng suối",
    exact: true
  })).toHaveValue("0.63");
  await page.getByRole("tab", {
    name: "Chọn nhanh",
    exact: true
  }).click();
  await expect(page.locator('.minimal-sound')).toContainText("Bản phối");
  await page.keyboard.press("Escape");
  await page.reload();
  await page.evaluate(() => (window as any).__emLifecycle.mountApp());
  await expect(page.locator("main")).toHaveAttribute("data-playing", "false");
  await expect(page.locator('.minimal-sound')).toContainText("Bản phối");
  await button(page, "Bắt đầu thư giãn").click();
  await expect(page.locator("main")).toHaveAttribute("data-playing", "true");
  const state = await page.evaluate(() => (window as any).__emLifecycle.status());
  expect(state.audio.activeSounds).toEqual(["rain", "stream"]);
  expect(state.audio.voices).toBe(2);
});
test("custom timer, cap, extension, all fade choices and recovery on shared visual/audio deadline", async ({
  page
}) => {
  await load(page, true);
  await custom(page, "1.5");
  await expect(page.getByRole("alert")).toContainText("số phút nguyên");
  await page.getByLabel("Số phút tùy chỉnh", {
    exact: true
  }).fill("720");
  await button(page, "Áp dụng").click();
  await expect(page.locator('.minimal-timer span')).toHaveText("12:00:00");
  await expect(button(page, "+5 phút")).toBeDisabled();
  await page.getByLabel("Số phút tùy chỉnh", {
    exact: true
  }).fill("1");
  await button(page, "Áp dụng").click();
  await button(page, "3 phút").click();
  await expect(page.getByText(/Phiên ngắn:/)).toBeVisible();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await button(page, "Bắt đầu thư giãn").click();
  await expect(page.locator("main")).toHaveAttribute("data-playing", "true");
  await page.clock.fastForward(30000);
  const before = Number(await page.locator("main").getAttribute("data-fade"));
  expect(before).toBeCloseTo(.5, 1);
  await page.keyboard.press("Tab");
  await page.clock.runFor(20);
  await page.getByRole("button", {
    name: /^Hẹn giờ:/
  }).click();
  await button(page, "+5 phút").click();
  const after = Number(await page.locator("main").getAttribute("data-fade"));
  expect(after).toBeCloseTo(before, 1);
  await page.clock.runFor(750);
  expect(Number(await page.locator("main").getAttribute("data-fade"))).toBeGreaterThan(before);
  await page.clock.runFor(1000);
  await expect(page.locator("main")).toHaveAttribute("data-fade", "1.000");
  await expect(page.getByRole("button", {
    name: /^Hẹn giờ:/
  })).toHaveAttribute("aria-label", "Hẹn giờ: 6 phút");
  await button(page, "Tạm dừng phiên thư giãn").click();
  const left = await page.locator("main").getAttribute("data-remaining");
  await page.clock.fastForward(60000);
  await expect(page.locator("main")).toHaveAttribute("data-remaining", left!);
  await expect(button(page, "+10 phút")).toBeEnabled();
  await button(page, "+10 phút").click();
  await expect(page.getByRole("button", {
    name: /^Hẹn giờ:/
  })).toHaveAttribute("aria-label", "Hẹn giờ: 16 phút");
  await button(page, "Không giới hạn").click();
  await expect(button(page, "1 phút")).toBeDisabled();
  await expect(button(page, "+5 phút")).toBeDisabled();
});
test("favorites CRUD, paused application, mute restoration, saved duration and no autoplay on reload", async ({
  page
}) => {
  await load(page);
  await mixer(page);
  await page.getByRole("switch", {
    name: "Tiếng suối",
    exact: true
  }).click();
  await page.keyboard.press("Escape");
  await custom(page, "45");
  await button(page, "1 phút").click();
  await page.keyboard.press("Escape");
  await button(page, "Âm lượng").click();
  await page.getByRole("slider", {
    name: "Âm lượng",
    exact: true
  }).fill("0.72");
  await button(page, "Tắt tiếng").click();
  await page.keyboard.press("Escape");
  await favorites(page);
  await page.getByLabel("Lưu cấu hình hiện tại", {
    exact: true
  }).fill(" Ngủ yên ");
  await button(page, "Lưu").click();
  const card = page.getByRole("article", {
    name: "Ngủ yên",
    exact: true
  });
  await expect(card).toBeVisible();
  await page.getByLabel("Lưu cấu hình hiện tại", {
    exact: true
  }).fill("ngủ yên");
  await button(page, "Lưu").click();
  await expect(page.getByRole("alert")).toContainText("Tên này đã có");
  await card.getByRole("button", {
    name: "Đổi tên",
    exact: true
  }).click();
  await page.getByLabel("Đổi tên phiên", {
    exact: true
  }).fill("Buổi tối");
  await button(page, "Lưu tên").click();
  await expect(page.getByRole("article", {
    name: "Buổi tối",
    exact: true
  })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(button(page, "Tùy chọn")).toBeFocused();
  await page.getByRole("button", {
    name: /^Hẹn giờ:/
  }).click();
  await button(page, "15 phút").click();
  await page.keyboard.press("Escape");
  await button(page, "Bắt đầu thư giãn").click();
  await expect(page.locator("main")).toHaveAttribute("data-playing", "true");
  await page.keyboard.press("Tab");
  await expect(button(page, "Tạm dừng phiên thư giãn")).toBeFocused();
  await favorites(page);
  await page.getByRole("article", {
    name: "Buổi tối",
    exact: true
  }).getByRole("button", {
    name: "Áp dụng",
    exact: true
  }).click();
  await expect(page.locator("main")).toHaveAttribute("data-playing", "false");
  await expect(page.locator("main")).toHaveAttribute("data-remaining", "2700000");
  await expect(page.locator('.minimal-sound')).toContainText("Bản phối");
  await expect.poll(() => page.evaluate(() => (window as any).__emLifecycle.status().audio.context)).toBe("suspended");
  await button(page, "Âm lượng").click();
  await expect(page.getByRole("slider", {
    name: "Âm lượng",
    exact: true
  })).toHaveValue("0");
  await button(page, "Bật tiếng").click();
  await expect(page.getByRole("slider", {
    name: "Âm lượng",
    exact: true
  })).toHaveValue("0.72");
  await page.keyboard.press("Escape");
  await favorites(page);
  await page.getByRole("article", {
    name: "Buổi tối",
    exact: true
  }).getByRole("button", {
    name: "Cập nhật",
    exact: true
  }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("em:favorites-v1")!).entries[0].config.volume)).toBe(.72);
  await page.keyboard.press("Escape");
  await page.reload();
  await page.evaluate(() => (window as any).__emLifecycle.mountApp());
  await expect(page.locator("main")).toHaveAttribute("data-playing", "false");
  await expect(page.locator("main")).toHaveAttribute("data-remaining", "1800000");
  await favorites(page);
  await expect(page.getByRole("article", {
    name: "Buổi tối",
    exact: true
  })).toBeVisible();
  await button(page, "Xóa").click();
  await button(page, "Hủy").click();
  await expect(button(page, "Áp dụng")).toBeVisible();
  await button(page, "Xóa").click();
  await button(page, "Xác nhận xóa").click();
  await expect(page.getByRole("article")).toHaveCount(0);
});
test("blocked storage keeps truthful in-memory favorites and favorite apply cancels pending start", async ({
  page
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("blocked");
      }
    });
    const post = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (...args: Parameters<Worker["postMessage"]>) {
      setTimeout(() => post.apply(this, args), 1500);
    };
  });
  await load(page);
  await favorites(page);
  await page.getByLabel("Lưu cấu hình hiện tại", {
    exact: true
  }).fill("Tạm");
  await button(page, "Lưu").click();
  await expect(page.getByText(/Thay đổi chỉ được giữ/)).toBeVisible();
  await expect(page.getByRole("article", {
    name: "Tạm",
    exact: true
  })).toBeVisible();
  await button(page, "Bắt đầu thư giãn").click();
  await expect(button(page, "Đang mở âm thanh")).toBeVisible();
  await button(page, "Áp dụng").click();
  await page.waitForTimeout(1800);
  await expect(page.locator("main")).toHaveAttribute("data-playing", "false");
  await expect(button(page, "Bắt đầu thư giãn")).toBeEnabled();
  expect((await page.evaluate(() => (window as any).__emLifecycle.status())).audio.wantedPlaying).toBe(false);
});
test("live preparation failure rolls UI back to committed mix without stopping the session", async ({
  page
}) => {
  await page.addInitScript(() => {
    const create = AudioContext.prototype.createBuffer;
    let buffers = 0;
    AudioContext.prototype.createBuffer = function (c, l, r) {
      if (l > r * 30 && ++buffers > 1) throw new Error("fail second source");
      return create.call(this, c, l, r);
    };
  });
  await load(page);
  await button(page, "Bắt đầu thư giãn").click();
  await expect(page.locator("main")).toHaveAttribute("data-playing", "true");
  await page.keyboard.press("Tab");
  await mixer(page);
  await page.getByRole("switch", {
    name: "Tiếng suối",
    exact: true
  }).click();
  await expect(page.getByRole("alert")).toContainText("Bản phối trước vẫn đang phát");
  await expect(page.getByRole("switch", {
    name: "Tiếng suối",
    exact: true
  })).not.toBeChecked();
  await expect(page.locator("main")).toHaveAttribute("data-playing", "true");
  expect((await page.evaluate(() => (window as any).__emLifecycle.status())).audio.activeSound).toBe("rain");
});
for (const [width, height] of [[1366, 768], [1440, 900], [1920, 1080]]) test(`expanded content ${width} stays in viewport and timer width is stable`, async ({
  page
}) => {
  await page.setViewportSize({
    width,
    height
  });
  await load(page);
  for (const kind of ["mix", "timer", "favorites"]) {
    if (kind === "mix") await mixer(page);else if (kind === "timer") await custom(page, "720");else await favorites(page);
    const panel = page.getByRole("dialog");
    await expect.poll(async () => {
      const box = (await panel.boundingBox())!;
      return box.x >= 11 && box.y >= 11 && box.x + box.width <= width - 11 && box.y + box.height <= height - 11;
    }).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.keyboard.press("Escape");
  }
  expect((await page.locator('.minimal-timer').boundingBox())!.width).toBe(120);
});
test("basic touch dialogs expose shared mixer and custom timer", async ({
  browser
}) => {
  const context = await browser.newContext({
    viewport: {
      width: 390,
      height: 844
    },
    hasTouch: true,
    isMobile: true
  });
  const page = await context.newPage();
  try {
    await load(page);
    await page.locator(".now-playing").click();
    await page.getByRole("tab", {
      name: "Trộn",
      exact: true
    }).click();
    await page.getByRole("switch", {
      name: "Tiếng suối",
      exact: true
    }).click();
    await page.getByRole("button", {
      name: "Đóng",
      exact: true
    }).click();
    await page.getByRole("button", {
      name: /^Hẹn giờ:/
    }).click();
    await page.getByLabel("Số phút tùy chỉnh", {
      exact: true
    }).fill("25");
    await button(page, "Áp dụng").click();
    await expect(page.locator("main")).toHaveAttribute("data-remaining", "1500000");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally {
    await context.close();
  }
});

test("favorites stop at ten and invalid persisted data has a recoverable warning", async ({page}) => {
  await page.addInitScript(() => {
    if(localStorage.getItem("em:test-seeded"))return;localStorage.setItem("em:test-seeded","yes");
    const config={mix:{rain:{enabled:true,level:1},stream:{enabled:false,level:.5},brown:{enabled:false,level:.5}},volume:.45,lastVolume:.45,duration:30,fadeSeconds:15,speed:"slow",reduced:false,showCount:false};
    localStorage.setItem("em:favorites-v1",JSON.stringify({version:1,entries:Array.from({length:10},(_,i)=>({id:String(i),name:`Phiên ${i+1}`,config}))}));
  });
  await load(page);await favorites(page);await expect(page.getByRole("article")).toHaveCount(10);await expect(button(page,"Lưu")).toBeDisabled();await page.getByRole("article",{name:"Phiên 1",exact:true}).getByRole("button",{name:"Xóa",exact:true}).click();await button(page,"Xác nhận xóa").click();await expect(button(page,"Lưu")).toBeEnabled();
  await page.evaluate(()=>localStorage.setItem("em:favorites-v1",'{}'));await page.goto("/lifecycle-qa.html");await page.evaluate(()=>(window as any).__emLifecycle.mountApp());await favorites(page);await expect(page.getByRole("article")).toHaveCount(0);await expect(page.getByText(/Không đọc được phiên đã lưu/)).toBeVisible();
});

test("mute leaves visual fade intact; end dims only the scene and pointer wakes without restarting",async({page})=>{
  await load(page,true);await custom(page,"1");await page.keyboard.press("Escape");await button(page,"Âm lượng").click();await button(page,"Tắt tiếng").click();await page.keyboard.press("Escape");await button(page,"Bắt đầu thư giãn").click();await expect(page.locator("main")).toHaveAttribute("data-playing","true");await page.clock.fastForward(52500);expect(Number(await page.locator("main").getAttribute("data-fade"))).toBeCloseTo(.5,1);const opacity=await page.locator('.sleep-shade').evaluate(el=>Number((el as HTMLElement).style.opacity));expect(opacity).toBeCloseTo(.35,1);
  await page.clock.fastForward(8500);await expect(page.locator("main")).toHaveAttribute("data-playing","false");await expect(page.locator("main")).toHaveAttribute("data-fade","0.000");await expect(page.locator('.sleep-shade')).toHaveAttribute("style","opacity: 0.7;");await expect(page.getByRole("toolbar")).toBeVisible();await page.mouse.move(710,320);await page.clock.runFor(20);await expect(page.locator('.sleep-shade')).toHaveAttribute("style","opacity: 0;");await expect(page.locator("main")).toHaveAttribute("data-playing","false");
});

test("rapid asynchronous mix edits commit only the final enabled channels",async({page})=>{
 await page.addInitScript(()=>{const post=Worker.prototype.postMessage;Worker.prototype.postMessage=function(...args:Parameters<Worker["postMessage"]>){setTimeout(()=>post.apply(this,args),400);};});await load(page);await button(page,"Bắt đầu thư giãn").click();await expect(page.locator("main")).toHaveAttribute("data-playing","true");await page.keyboard.press("Tab");await mixer(page);
 for(const label of ["Tiếng suối","Brown noise","Tiếng suối","Mưa nhẹ"])await page.getByRole("switch",{name:label,exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as any).__emLifecycle.status().audio.activeSounds)).toEqual(["brown"]);await page.waitForTimeout(500);const state=await page.evaluate(()=>(window as any).__emLifecycle.status().audio);expect(state.activeSounds).toEqual(["brown"]);expect(state.voices).toBeLessThanOrEqual(3);expect(state.levels[0]).toBe(0);expect(state.levels[1]).toBe(0);expect(state.levels[2]).toBeCloseTo(.5,4);await expect(page.locator("main")).toHaveAttribute("data-playing","true");
});
