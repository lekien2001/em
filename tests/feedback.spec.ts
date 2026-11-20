import { expect, test, type Page } from "@playwright/test";

async function openApp(page: Page) {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
      return type.startsWith("webgl") ? null : Reflect.apply(getContext, this, [type, ...args]);
    } as typeof getContext;
  });
  await page.goto("/");
}

const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });

test("feedback preserves the session and draft, validates fields, and retries the same submission", async ({ page }) => {
  await openApp(page);
  const main = page.locator("main");
  const options = button(page, "Tùy chọn");
  const dialog = page.getByRole("dialog", { name: "Góp ý", exact: true });
  const send = button(page, "Gửi góp ý");
  const message = dialog.getByLabel("Nội dung góp ý");
  const email = dialog.getByLabel(/Email/);
  const payloads: unknown[] = [];
  let releaseFirst = () => {};
  const firstResponse = new Promise<void>(resolve => { releaseFirst = resolve; });
  await page.route("**/api/feedback", async route => {
    payloads.push(route.request().postDataJSON());
    if (payloads.length === 1) {
      await firstResponse;
      await route.abort("internetdisconnected");
    } else {
      await route.fulfill({ json: { ok: true } });
    }
  });

  await button(page, "Bắt đầu thư giãn").press("Enter");
  await expect(main).toHaveAttribute("data-playing", "true");
  const remaining = Number(await main.getAttribute("data-remaining"));
  await page.keyboard.press("Tab");
  await options.click();
  await button(page, "Góp ý").click();
  const topic = dialog.getByLabel("Chủ đề");
  await expect(topic).toBeFocused();
  await expect(topic).toHaveValue("general");
  await page.keyboard.press("Tab");
  await expect(message).toBeFocused();
  await send.click();
  await expect(message).toBeFocused();
  await expect(message).toHaveAttribute("aria-invalid", "true");
  await message.fill("Muốn thêm âm thanh gió.");
  await email.fill("sai-email");
  await send.click();
  await expect(email).toBeFocused();
  await expect(email).toHaveAttribute("aria-invalid", "true");
  expect(payloads).toHaveLength(0);
  await email.fill("  ");
  await topic.selectOption("idea");
  await button(page, "Quay lại Tùy chọn").click();
  await button(page, "Góp ý").click();
  await expect(message).toHaveValue("Muốn thêm âm thanh gió.");
  await expect(topic).toHaveValue("idea");

  try {
    await send.click();
    await expect(dialog.getByRole("status")).toHaveText("Đang gửi góp ý…");
    await expect(send).toBeDisabled();
    await dialog.locator("form").evaluate((form: HTMLFormElement) => form.requestSubmit());
    await expect.poll(() => payloads.length).toBe(1);
    await page.keyboard.press("Escape");
    await expect(options).toBeFocused();
  } finally {
    releaseFirst();
  }
  await options.click();
  await button(page, "Góp ý").click();
  await expect(dialog.getByRole("alert")).toContainText("Bản nháp vẫn còn");
  await expect(message).toHaveValue("Muốn thêm âm thanh gió.");
  await button(page, "Thử lại").click();
  await expect(dialog.getByRole("status")).toHaveText("Cảm ơn bạn. Êm đã nhận được góp ý!");
  expect(payloads).toHaveLength(2);
  expect(payloads[1]).toEqual(payloads[0]);
  expect(payloads[0]).toMatchObject({ category: "idea", email: null, message: "Muốn thêm âm thanh gió." });
  await expect(message).toHaveValue("");
  await expect(main).toHaveAttribute("data-playing", "true");
  await expect.poll(async () => Number(await main.getAttribute("data-remaining"))).toBeLessThan(remaining);
});

test("feedback opens from touch scene options and is usable on a narrow screen", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 680 }, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage();
    await openApp(page);
    const trigger = button(page, "Góp ý");
    await trigger.tap();
    const dialog = page.getByRole("dialog", { name: "Góp ý", exact: true });
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await dialog.getByLabel("Nội dung góp ý").fill("Thêm một âm thanh êm.");
    await dialog.getByLabel(/Email/).fill("test@example.com");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
    await dialog.getByRole("button", { name: "Đóng" }).tap();
    await trigger.tap();
    await expect(dialog.getByLabel("Nội dung góp ý")).toHaveValue("Thêm một âm thanh êm.");
    await expect(dialog.getByLabel(/Email/)).toHaveValue("test@example.com");
  } finally {
    await context.close();
  }
});
