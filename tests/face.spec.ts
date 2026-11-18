import { test, expect, type Page } from "@playwright/test";
import { build } from "esbuild";
import fs from "node:fs/promises";
test.beforeAll(async () => {
  await build({
    entryPoints: ["tests/support/face-image-harness.ts"],
    bundle: true,
    target: "es2022",
    format: "iife",
    outfile: "dist/face-image-qa.js"
  });
  await fs.writeFile("dist/face-image-qa.html", '<!doctype html><html><link rel="icon" href="data:,"><script src="/face-image-qa.js"></script></html>');
  await build({
    entryPoints: ["tests/support/face-render-harness.ts"],
    bundle: true,
    target: "es2022",
    format: "esm",
    outfile: "dist/face-render-qa.js"
  });
  await fs.writeFile("dist/face-render-qa.html", '<!doctype html><html><link rel="icon" href="data:,"><script type="module" src="/face-render-qa.js"></script></html>');
});
test("real GPU resources: 30 replacements, eight viewpoints, natural skin color and clean disposal", async ({
  page
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("/face-render-qa.html");
  await page.waitForFunction(() => (window as any).__faceRender);
  const result = await page.evaluate(() => {
    const api = (window as any).__faceRender,
      rows = [],
      views = [];
    for (let i = 0; i < 30; i++) {
      rows.push(api.apply());
      api.pose(["Idle", "Walk", "Jump", "Land"][i % 4], .2);
      const restored = api.restore();
      if (restored.textures !== api.baseline.textures) throw new Error("Photo texture retained after restore");
    }
    api.apply();
    api.pose("Idle", 0);
    for (let angle = 0; angle < 8; angle++) views.push(api.view(angle * Math.PI / 4));
    return {
      baseline: api.baseline,
      rows,
      views,
      final: api.dispose()
    };
  });
  expect(result.rows.every(row => row.textures === result.baseline.textures + 1)).toBe(true);
  expect(new Set(result.rows.map(row => row.geometries)).size).toBe(1);
  expect(result.views[0].photoPixels).toBeGreaterThan(1000);
  expect(result.views[4].photoPixels).toBe(0);
  expect(result.final.rendererCacheTextures).toBe(1);
  expect(result.final.memory).toEqual({ geometries: 0, textures: result.final.rendererCacheTextures });
  expect(result.final.contextLost).toBe(true);
  expect(result.final.repeatedDisposals).toBe(0);
  expect(errors).toEqual([]);
});
async function portrait(page: Page) {
  const png = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 800;
    c.height = 1200;
    const x = c.getContext("2d")!;
    x.fillStyle = "#53a99c";
    x.fillRect(0, 0, 800, 1200);
    x.fillStyle = "#eab594";
    x.beginPath();
    x.ellipse(400, 600, 280, 440, 0, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = "#55372c";
    x.beginPath();
    x.ellipse(400, 250, 280, 180, 0, Math.PI, Math.PI * 2);
    x.fill();
    x.fillStyle = "#23343d";
    x.fillRect(250, 480, 65, 30);
    x.fillRect(485, 480, 65, 30);
    x.fillStyle = "#a33953";
    x.fillRect(320, 790, 160, 25);
    x.fillStyle = "#ef3942";
    x.fillRect(140, 360, 65, 80);
    x.fillStyle = "#246ff0";
    x.fillRect(595, 360, 65, 80);
    return c.toDataURL().split(",")[1];
  });
  return {
    name: "portrait.png",
    mimeType: "image/png",
    buffer: Buffer.from(png, "base64")
  };
}
async function openEditor(page: Page) {
  await page.getByRole("button", {
    name: "Tùy chọn",
    exact: true
  }).click();
  await page.getByRole("button", {
    name: "Mặt cừu của bạn",
    exact: true
  }).click();
  await expect(page.getByRole("dialog", {
    name: "Mặt cừu của bạn"
  })).toBeVisible();
}
test("Canvas: uniform fit, alpha feather, asymmetric orientation, invalid files and yielding read paths", async ({
  page
}) => {
  await page.goto("/face-image-qa.html");
  const file = await portrait(page);
  const result = await page.evaluate(async ({
    base64
  }) => {
    const api = (window as any).__faceImage,
      bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const source = await api.readPhoto(new File([bytes], "portrait.png", {
      type: "image/png"
    }));
    const canvas = api.exportFace(source, api.initialCrop()),
      x = canvas.getContext("2d")!;
    const preview = api.createFaceSurface("preview");
    const sampleCrop = { x: 33, y: -41, zoom: 1.3, rotation: 12 };
    preview.paint(source, api.initialCrop());
    preview.paint(source, sampleCrop);
    const full = api.exportFace(source, sampleCrop);
    const previewContext = preview.canvas.getContext("2d")!;
    const fullContext = full.getContext("2d")!;
    const differences = [[0, 0], [192, 256], [110, 195], [257, 320]].map(([u, v]) => {
      const a = previewContext.getImageData(u, v, 1, 1).data;
      const b = fullContext.getImageData(u * 2, v * 2, 1, 1).data;
      return Math.max(...Array.from(a, (value, channel) => Math.abs(value - b[channel])));
    });
    const pixel = (u: number, v: number) => Array.from(x.getImageData(u, v, 1, 1).data);
    const fits = [];
    for (const rotation of [-180, -90, -37, 0, 41, 90, 180]) {
      const f = api.fitCrop(source, {
        x: 100000,
        y: -100000,
        zoom: 2,
        rotation
      });
      fits.push(Number.isFinite(f.scale) && f.scale > 0);
    }
    let invalid = "";
    try {
      await api.readPhoto(new File(["bad"], "face.svg", {
        type: "image/svg+xml"
      }));
    } catch (e) {
      invalid = String(e);
    }
    let corrupt = "";
    try {
      await api.readPhoto(new File([new Uint8Array([255, 216, 0, 0])], "bad.jpg", {
        type: "image/jpeg"
      }));
    } catch (e) {
      corrupt = String(e);
    }
    return {
      width: canvas.width,
      height: canvas.height,
      preview: [preview.canvas.width, preview.canvas.height],
      differences,
      corner: pixel(0, 0),
      edge: pixel(384, 2),
      middle: pixel(384, 512),
      left: pixel(180, 360),
      right: pixel(588, 360),
      fits,
      invalid,
      corrupt
    };
  }, {
    base64: file.buffer.toString("base64")
  });
  expect([result.width, result.height]).toEqual([768, 1024]);
  expect(result.preview).toEqual([384, 512]);
  expect(Math.max(...result.differences)).toBeLessThan(5);
  expect(result.corner[3]).toBe(0);
  expect(result.edge[3]).toBeGreaterThan(0);
  expect(result.edge[3]).toBeLessThan(255);
  expect(result.middle[3]).toBe(255);
  expect(result.fits.every(Boolean)).toBe(true);
  expect(result.invalid).toContain("JPEG");
  expect(result.corrupt).toContain("Không đọc được");
});
test("real WebGL: choose, crop, preview, apply to three animated sheep, edit/cancel, restore and reload", async ({
  page
}) => {
  test.setTimeout(240000);
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("/?qa=1");
  await expect(page.locator(".canvas-host")).toHaveAttribute("data-model-source", "/assets/sheep.glb", {
    timeout: 90000
  });
  const file = await portrait(page);
  await openEditor(page);
  await page.getByLabel("Chọn ảnh khuôn mặt").setInputFiles(file);
  await expect(page.getByRole("button", {
    name: "Áp dụng",
    exact: true
  })).toBeEnabled({
    timeout: 60000
  });
  const zoom = page.getByRole("slider", {
    name: "Phóng to ảnh"
  });
  await zoom.fill("1.2");
  await page.getByRole("slider", {
    name: "Xoay ảnh"
  }).fill("8");
  const crop = page.locator(".face-crop"),
    rect = (await crop.boundingBox())!;
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.down();
  await page.mouse.move(rect.x + rect.width / 2 + 10, rect.y + rect.height / 2 + 10, {
    steps: 5
  });
  await page.mouse.up();
  await expect(page.getByRole("button", {
    name: "Áp dụng",
    exact: true
  })).toBeEnabled();
  await page.locator(".face-preview").screenshot({
    path: "/tmp/em-face-preview.png"
  });
  await page.getByRole("button", {
    name: "Áp dụng",
    exact: true
  }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__emQA.world.actors.map((a: any) => a.root.getObjectByName("Personal face")?.visible))).toEqual([true, true, true]);
  const positions = await page.evaluate(() => (window as any).__emQA.world.actors.map((a: any) => a.root.getObjectByName("Personal face").matrixWorld.toArray()));
  expect(await page.evaluate(() => {
    const actor = (window as any).__emQA.world.actors[0];
    const image = actor.root.getObjectByName("Photo surface").material.map.image;
    return [image.width, image.height];
  })).toEqual([768, 1024]);
  await page.getByRole("button", {
    name: "Bắt đầu thư giãn",
    exact: true
  }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toHaveAttribute("data-playing", "true");
  await page.waitForTimeout(3500);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", {
    name: "Tạm dừng phiên thư giãn",
    exact: true
  })).toBeFocused();
  await page.keyboard.press("Space");
  await expect(page.locator("main")).toHaveAttribute("data-playing", "false");
  expect(await page.evaluate(() => (window as any).__emQA.world.actors.map((a: any) => a.root.getObjectByName("Personal face").matrixWorld.toArray()))).not.toEqual(positions);
  await openEditor(page);
  await expect(page.getByRole("slider", {
    name: "Xoay ảnh"
  })).toHaveValue("8");
  await page.getByRole("slider", {
    name: "Xoay ảnh"
  }).fill("-20");
  await page.keyboard.press("Escape");
  await openEditor(page);
  await expect(page.getByRole("slider", {
    name: "Xoay ảnh"
  })).toHaveValue("8");
  await page.getByLabel("Chọn ảnh khuôn mặt").setInputFiles({
    name: "bad.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from("<svg/>")
  });
  await expect(page.getByRole("alert")).toContainText("JPEG");
  await expect(page.locator(".face-crop")).toBeVisible();
  await page.getByRole("button", {
    name: "Khôi phục",
    exact: true
  }).click();
  await page.keyboard.press("Escape");
  await expect.poll(() => page.evaluate(() => (window as any).__emQA.world.actors.every((a: any) => !a.root.getObjectByName("Personal face")))).toBe(true);
  await openEditor(page);
  await expect(page.locator(".face-empty")).toBeVisible();
  await page.getByLabel("Chọn ảnh khuôn mặt").setInputFiles(file);
  await expect(page.getByRole("button", {
    name: "Áp dụng",
    exact: true
  })).toBeEnabled();
  await page.getByRole("button", {
    name: "Áp dụng",
    exact: true
  }).click();
  expect(await page.evaluate(() => Object.keys(localStorage).some(k => /face|photo|portrait/.test(k)))).toBe(false);
  await page.reload();
  await expect(page.locator(".canvas-host")).toHaveAttribute("data-model-source", "/assets/sheep.glb", {
    timeout: 90000
  });
  await openEditor(page);
  await expect(page.locator(".face-empty")).toBeVisible();
  await page.getByLabel("Chọn ảnh khuôn mặt").setInputFiles(file);
  await expect(page.getByRole("button", { name: "Áp dụng", exact: true })).toBeEnabled();
  await page.locator(".face-preview canvas").evaluate(canvas => canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true })));
  await expect(page.getByRole("button", { name: "Áp dụng", exact: true })).toBeDisabled();
  await page.getByRole("slider", { name: "Xoay ảnh" }).fill("30");
  await page.waitForTimeout(200);
  await expect(page.getByRole("button", { name: "Áp dụng", exact: true })).toBeDisabled();
  expect(errors).toEqual([]);
});
test("fallback: invalid image is explained, apply disabled, keyboard focus stays in editor", async ({
  page
}) => {
  await page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind: any, ...args: any[]) {
      return /webgl/.test(kind) ? null : (get as any).call(this, kind, ...args);
    } as any;
  });
  await page.goto("/");
  await openEditor(page);
  await page.getByLabel("Chọn ảnh khuôn mặt").setInputFiles({
    name: "bad.heic",
    mimeType: "image/heic",
    buffer: Buffer.from("heic")
  });
  await expect(page.getByRole("alert")).toContainText("HEIC");
  await expect(page.getByRole("button", {
    name: "Áp dụng",
    exact: true
  })).toBeDisabled();
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});
test("phone JPEG EXIF 1–8 is oriented exactly once, including image-element fallback", async ({
  page
}) => {
  await page.goto("/face-image-qa.html");
  const results = await page.evaluate(async () => {
    const api = (window as any).__faceImage,
      canvas = document.createElement("canvas");
    canvas.width = 80;
    canvas.height = 120;
    const context = canvas.getContext("2d")!;
    for (const [color, x, y] of [["#ff0000", 0, 0], ["#00ff00", 40, 0], ["#0000ff", 0, 60], ["#ffff00", 40, 60]] as const) {
      context.fillStyle = color;
      context.fillRect(x, y, 40, 60);
    }
    const raw = Uint8Array.from(atob(canvas.toDataURL("image/jpeg", 1).split(",")[1]), c => c.charCodeAt(0));
    const native = window.createImageBitmap,
      rows = [];
    for (const fallback of [false, true]) {
      if (fallback) window.createImageBitmap = async () => {
        throw new Error("Bitmap unavailable");
      };
      for (let orientation = 1; orientation <= 8; orientation++) {
        const exif = new Uint8Array([255, 225, 0, 34, 69, 120, 105, 102, 0, 0, 73, 73, 42, 0, 8, 0, 0, 0, 1, 0, 18, 1, 3, 0, 1, 0, 0, 0, orientation, 0, 0, 0, 0, 0, 0, 0]);
        const file = new File([raw.slice(0, 2), exif, raw.slice(2)], "phone.jpg", {
          type: "image/jpeg"
        });
        const result = await api.readPhoto(file),
          pixel = result.getContext("2d").getImageData(10, 10, 1, 1).data;
        rows.push({
          fallback,
          orientation,
          width: result.width,
          height: result.height,
          rgb: Array.from(pixel).slice(0, 3)
        });
      }
    }
    window.createImageBitmap = native;
    return rows;
  });
  const colors = [[255, 0, 0], [0, 255, 0], [255, 255, 0], [0, 0, 255], [255, 0, 0], [0, 0, 255], [255, 255, 0], [0, 255, 0]];
  for (const row of results) {
    expect([row.width, row.height]).toEqual(row.orientation >= 5 ? [120, 80] : [80, 120]);
    row.rgb.forEach((channel, i) => expect(Math.abs(channel - colors[row.orientation - 1][i])).toBeLessThan(8));
  }
});
for (const viewport of [{
  width: 390,
  height: 844
}, {
  width: 844,
  height: 390
}]) test(`touch crop ${viewport.width}×${viewport.height} supports drag/pinch/rotation without horizontal scroll`, async ({
  browser
}) => {
  const context = await browser.newContext({
      viewport,
      isMobile: true,
      hasTouch: true
    }),
    page = await context.newPage();
  try {
    await page.addInitScript(() => {
      const get = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (kind: any, ...args: any[]) {
        return /webgl/.test(kind) ? null : (get as any).call(this, kind, ...args);
      } as any;
    });
    await page.goto("/");
    await page.getByRole("button", {
      name: "Mặt cừu của bạn",
      exact: true
    }).tap();
    await page.getByLabel("Chọn ảnh khuôn mặt").setInputFiles(await portrait(page));
    const crop = page.locator(".face-crop");
    await expect(crop).toBeVisible();
    await crop.scrollIntoViewIfNeeded();
    const rect = (await crop.boundingBox())!,
      cdp = await context.newCDPSession(page);
    const x = rect.x + 50,
      y = Math.max(50, rect.y + 60);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{
        x,
        y,
        id: 10
      }, {
        x: x + 80,
        y,
        id: 11
      }]
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{
        x,
        y,
        id: 10
      }, {
        x: x + 130,
        y: y + 40,
        id: 11
      }]
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: []
    });
    expect(Number(await page.getByRole("slider", {
      name: "Phóng to ảnh"
    }).inputValue())).toBeGreaterThan(1);
    expect(Math.abs(Number(await page.getByRole("slider", {
      name: "Xoay ảnh"
    }).inputValue()))).toBeGreaterThan(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("button", {
      name: "Khôi phục",
      exact: true
    }).tap();
    await expect(page.locator(".face-empty")).toBeVisible();
  } finally {
    await context.close();
  }
});
