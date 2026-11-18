import { test, expect, type Page } from "@playwright/test";
import { placePanel } from "../src/ui/panelPlacement";
async function fallback(page: Page) {
  await page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind: any, ...args: any[]) {
      return /webgl/.test(kind) ? null : (get as any).call(this, kind, ...args);
    } as any;
  });
}
for (const [width, height] of [[1366, 768], [1440, 900], [1920, 1080]]) test(`settings ${width}×${height}: aligned rows, segmented speed and nonmodal positioning`, async ({
  page
}) => {
  await page.setViewportSize({
    width,
    height
  });
  await fallback(page);
  await page.goto("/");
  const bar = page.getByRole("toolbar");
  await expect(bar.getByRole("button")).toHaveCount(5);
  await page.getByRole("button", {
    name: "Tùy chọn",
    exact: true
  }).click();
  const panel = page.getByRole("dialog", {
    name: "Tùy chọn",
    exact: true
  });
  await expect(panel).toHaveAttribute("aria-modal", "false");
  await expect(panel).toHaveAttribute("data-side", "right");
  await expect(panel.getByRole("combobox")).toHaveCount(0);
  await expect(panel.getByRole("switch", {
    name: "Hiện số đếm",
    exact: true
  })).not.toBeChecked();
  await expect(panel.getByRole("radio", {
    name: "Chậm",
    exact: true
  })).toBeChecked();
  await panel.getByRole("radio", {
    name: "Vừa",
    exact: true
  }).check();
  await expect(panel.getByRole("radio", {
    name: "Vừa",
    exact: true
  })).toBeChecked();
  await panel.getByRole("switch", {
    name: "Hiện số đếm",
    exact: true
  }).click();
  await expect(page.locator(".minimal-count")).toBeVisible();
  await panel.getByRole("switch", {
    name: "Giảm chuyển động",
    exact: true
  }).click();
  await expect(panel.getByRole("radio", {
    name: "Chậm",
    exact: true
  })).toBeChecked();
  await expect(panel.getByRole("radio", {
    name: "Vừa",
    exact: true
  })).toBeDisabled();
  await expect(panel.getByText("Cố định ở Chậm khi giảm chuyển động.")).toBeVisible();
  await panel.getByRole("switch", {
    name: "Giảm chuyển động",
    exact: true
  }).click();
  await expect(panel.getByRole("radio", {
    name: "Vừa",
    exact: true
  })).toBeChecked();
  await panel.getByRole("radio", {
    name: "Vừa",
    exact: true
  }).focus();
  await page.keyboard.press("ArrowLeft");
  await expect(panel.getByRole("radio", {
    name: "Chậm",
    exact: true
  })).toBeChecked();
  const p = (await panel.boundingBox())!,
    b = (await bar.boundingBox())!;
  expect(p.x).toBeGreaterThanOrEqual(b.x + b.width + 11);
  expect(p.x + p.width).toBeLessThanOrEqual(width - 11);
  expect(p.y).toBeGreaterThanOrEqual(11);
  expect(p.y + p.height).toBeLessThanOrEqual(height - 11);
  const heights = await panel.locator(".setting-row, .speed-segments input").evaluateAll(els => els.map(el => (el as HTMLElement).offsetHeight));
  expect(heights.every(h => h >= 44)).toBe(true);
  await page.screenshot({
    path: `/tmp/em-settings-${width}.png`,
    animations: "disabled"
  });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", {
    name: "Tùy chọn",
    exact: true
  })).toBeFocused();
});
test("panels switch or toggle in one click, allow Play/Pause, and dismiss without trapping focus", async ({
  page
}) => {
  await fallback(page);
  await page.goto("/");
  await page.getByRole("button", {
    name: "Tùy chọn",
    exact: true
  }).click();
  await page.getByRole("button", {
    name: "Âm lượng",
    exact: true
  }).click();
  await expect(page.getByRole("dialog", {
    name: "Âm lượng",
    exact: true
  })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(page.getByRole("slider", {
    name: "Âm lượng",
    exact: true
  })).toBeFocused();
  await expect(page.getByRole("button", {
    name: "Âm lượng",
    exact: true
  })).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("button", {
    name: "Bắt đầu thư giãn",
    exact: true
  }).click();
  await expect(page.locator("main")).toHaveAttribute("data-playing", "true");
  await expect(page.getByRole("dialog", {
    name: "Âm lượng",
    exact: true
  })).toBeVisible();
  await page.getByRole("button", {
    name: "Tạm dừng phiên thư giãn",
    exact: true
  }).click();
  await expect(page.locator("main")).toHaveAttribute("data-playing", "false");
  await page.getByRole("button", {
    name: "Âm lượng",
    exact: true
  }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", {
    name: "Âm lượng",
    exact: true
  }).click();
  await page.mouse.click(50, 50);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", {
    name: "Tùy chọn",
    exact: true
  }).click();
  await page.evaluate(() => {
    const main = document.querySelector("main")!;
    main.tabIndex = 0;
    main.focus();
  });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("main")).toBeFocused();
});
test("mute restores 72 percent after reload, slider zero keeps last audible value", async ({
  page
}) => {
  await fallback(page);
  await page.goto("/");
  const open = () => page.getByRole("button", {
    name: "Âm lượng",
    exact: true
  }).click();
  await open();
  const slider = page.getByRole("slider", {
    name: "Âm lượng",
    exact: true
  });
  await slider.fill("0.72");
  await expect(page.getByLabel("Mức âm lượng", {
    exact: true
  })).toHaveText("72%");
  await page.getByRole("button", {
    name: "Tắt tiếng",
    exact: true
  }).click();
  await expect(slider).toHaveValue("0");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("em:last-volume"))).toBe("0.72");
  await page.reload();
  await open();
  await page.getByRole("button", {
    name: "Bật tiếng",
    exact: true
  }).click();
  await expect(slider).toHaveValue("0.72");
  await slider.fill("0");
  await page.getByRole("button", {
    name: "Bật tiếng",
    exact: true
  }).click();
  await expect(slider).toHaveValue("0.72");
});
test("library has one name per sound; timer uses a fixed display and explains resetting", async ({
  page
}) => {
  await fallback(page);
  await page.goto("/");
  await expect(page.locator(".minimal-timer span")).toHaveText("30:00");
  const width = (await page.locator(".minimal-bar").boundingBox())!.width;
  await page.getByRole("button", {
    name: /^Chọn âm thanh/
  }).click();
  const sounds = page.getByRole("dialog", {
    name: "Âm thanh",
    exact: true
  }).locator(".compact-sound");
  await expect(sounds).toHaveCount(6);
  expect(await sounds.allTextContents()).toEqual(["Mưa nhẹ", "Tiếng suối", "Brown noise", "Mưa bên cửa sổ", "Âm miệng ASMR", "Lục hộp LEGO"]);
  await page.getByRole("button", {
    name: "Brown noise",
    exact: true
  }).click();
  await expect(page.locator(".minimal-sound span")).toHaveText("Brown noise");
  await page.getByRole("button", {
    name: /^Hẹn giờ:/
  }).click();
  await expect(page.getByText("Chọn thời lượng sẽ bắt đầu lại đồng hồ. Cộng phút giữ nguyên thời gian đã nghe.")).toBeVisible();
  await page.getByRole("button", {
    name: "15 phút",
    exact: true
  }).click();
  await expect(page.locator(".minimal-timer span")).toHaveText("15:00");
  await expect(page.getByRole("dialog", { name: "Hẹn giờ", exact: true })).toBeVisible();
  await page.getByRole("button", {
    name: "Không giới hạn",
    exact: true
  }).click();
  await expect(page.locator(".minimal-timer span")).toHaveText("∞");
  expect((await page.locator(".minimal-bar").boundingBox())!.width).toBeCloseTo(width, 0);
});
test("short/narrow desktop panels stay within the viewport and resize in place", async ({
  page
}) => {
  await page.setViewportSize({
    width: 900,
    height: 500
  });
  await fallback(page);
  await page.goto("/");
  await page.getByRole("button", {
    name: "Tùy chọn",
    exact: true
  }).click();
  const panel = page.getByRole("dialog");
  await expect(panel).toHaveAttribute("data-side", "above");
  for (const [width, height] of [[900, 500], [1440, 900], [900, 400]]) {
    await page.setViewportSize({
      width,
      height
    });
    await expect.poll(async () => {
      const r = (await panel.boundingBox())!;
      return r.x >= 11 && r.y >= 11 && r.x + r.width <= width - 11 && r.y + r.height <= height - 11;
    }).toBe(true);
  }
});
test("invalid saved last volume falls back to 45 percent", async ({
  page
}) => {
  await fallback(page);
  await page.addInitScript(() => {
    localStorage.setItem("em:volume", "0");
    localStorage.setItem("em:last-volume", "NaN");
  });
  await page.goto("/");
  await page.getByRole("button", {
    name: "Âm lượng",
    exact: true
  }).click();
  await page.getByRole("button", {
    name: "Bật tiếng",
    exact: true
  }).click();
  await expect(page.getByRole("slider", {
    name: "Âm lượng",
    exact: true
  })).toHaveValue("0.45");
});
test("blocked storage still restores the audible volume in memory", async ({
  page
}) => {
  await fallback(page);
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("Storage blocked");
      }
    });
  });
  await page.goto("/");
  await page.getByRole("button", {
    name: "Âm lượng",
    exact: true
  }).click();
  const slider = page.getByRole("slider", {
    name: "Âm lượng",
    exact: true
  });
  await slider.fill("0.72");
  await page.getByRole("button", {
    name: "Tắt tiếng",
    exact: true
  }).click();
  await page.getByRole("button", {
    name: "Bật tiếng",
    exact: true
  }).click();
  await expect(slider).toHaveValue("0.72");
});
test("placement prefers left when the right side is blocked", () => {
  const result = placePanel({
    width: 1600,
    height: 900
  }, {
    left: 1000,
    right: 1390,
    top: 810,
    bottom: 872,
    width: 390
  }, {
    left: 1330,
    right: 1380,
    top: 817,
    bottom: 861,
    width: 50
  }, {
    width: 340,
    height: 480
  }, false);
  expect(result).toEqual({
    left: 648,
    top: 392,
    maxHeight: 876,
    side: "left"
  });
});
test("face editor Escape returns keyboard focus to the settings trigger", async ({ page }) => {
  await fallback(page);
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Tùy chọn", exact: true });
  await trigger.click();
  await page.getByRole("button", { name: "Mặt cừu của bạn", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Mặt cừu của bạn", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
