import { test, expect, type Locator, type Page } from "@playwright/test";

async function fallback(page: Page) {
  await page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind: any, ...args: any[]) {
      return /webgl/.test(kind) ? null : (get as any).call(this, kind, ...args);
    } as any;
  });
}
const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
async function centeredLabel(control: Locator, label: Locator) {
  const a = (await control.boundingBox())!, b = (await label.boundingBox())!;
  expect(Math.abs(a.x + a.width / 2 - b.x - b.width / 2)).toBeLessThanOrEqual(1);
  expect(Math.abs(a.y + a.height / 2 - b.y - b.height / 2)).toBeLessThanOrEqual(1);
}
async function withinViewport(page: Page) {
  await expect.poll(async () => page.getByRole("dialog").evaluate(el => {
    const r = el.getBoundingClientRect();
    return r.x >= 11 && r.y >= 11 && r.right <= innerWidth - 11 && r.bottom <= innerHeight - 11;
  })).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

for (const [width, height] of [[1366, 768], [1440, 900], [1920, 1080]]) {
  for (const dpr of [1, 1.25, 1.5]) {
    test(`balanced controls ${width}×${height} DPR ${dpr}`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr });
      const page = await context.newPage();
      try {
        await fallback(page); await page.goto("/"); await page.evaluate(() => document.fonts.ready);
        const toolbar = page.getByRole("toolbar"), initial = (await toolbar.boundingBox())!;
        const boxes = await toolbar.getByRole("button").evaluateAll(els => els.map(el => { const r = el.getBoundingClientRect(); return { w: r.width, h: r.height }; }));
        expect(boxes.map(b => b.w)).toEqual([44, 140, 44, 120, 44]);
        expect(boxes.every(b => b.h === 44)).toBe(true);
        expect(Math.abs(initial.x + initial.width / 2 - width / 2)).toBeLessThanOrEqual(1);
        for (const name of ["Mưa nhẹ", "Tiếng suối", "Brown noise"]) {
          await page.getByRole("button", { name: /^Chọn âm thanh/ }).click();
          await button(page, name).click();
          await centeredLabel(page.locator('.minimal-sound'), page.locator('.minimal-sound > span'));
          expect((await toolbar.boundingBox())!.width).toBe(initial.width);
        }
        await page.getByRole("button", { name: /^Hẹn giờ:/ }).click();
        const durations = page.locator('.compact-timers button');
        for (const minutes of [15, 30, 60, 0]) {
          await button(page, minutes ? `${minutes} phút` : "Không giới hạn").click();
          for (const duration of await durations.all()) await centeredLabel(duration, duration.locator('span'));
        }
        await button(page, "30 phút").click();
        const field = page.getByLabel("Số phút tùy chỉnh", { exact: true }), apply = button(page, "Áp dụng");
        await field.fill("1.5"); await apply.click(); await expect(page.getByRole('alert')).toContainText('số phút nguyên');
        await field.focus();
        const focused = await field.evaluate(el => { const s = getComputedStyle(el); return { h: el.getBoundingClientRect().height, outline: s.outlineStyle, shadow: s.boxShadow, appearance: s.appearance }; });
        expect(focused.h).toBe(44); expect(focused.outline).toBe('none'); expect(focused.shadow).toMatch(/0px 0px 0px 2px/); expect(focused.appearance).toBe('textfield');
        const dimensions = await field.evaluate(element => {
          const a = element.getBoundingClientRect();
          const b = element.nextElementSibling!.getBoundingClientRect();
          return { buttonWidth: b.width, heightDelta: b.height - a.height, topDelta: b.top - a.top };
        });
        expect(dimensions).toEqual({ buttonWidth: 80, heightDelta: 0, topDelta: 0 });
        await field.fill("59"); await field.press('ArrowUp'); await expect(field).toHaveValue('60'); await apply.click();
        await field.fill("720"); await apply.click(); await expect(page.locator('.minimal-timer > span')).toHaveText('12:00:00');
        expect((await toolbar.boundingBox())!.width).toBe(initial.width);
        await withinViewport(page);
        if (dpr === 1) await page.getByRole('dialog').screenshot({ path: `/tmp/em-polish-timer-${width}.png`, animations: 'disabled' });
        await page.keyboard.press('Escape');
        await button(page, 'Tùy chọn').click();
        const slots = await page.locator('.desktop-settings .setting-slot').evaluateAll(els => els.map(el => {
          const row = el.parentElement!.getBoundingClientRect(), slot = el.getBoundingClientRect(), visual = el.firstElementChild!.getBoundingClientRect();
          return { center: slot.x + slot.width / 2, dy: Math.abs(row.y + row.height / 2 - visual.y - visual.height / 2), dx: Math.abs(slot.x + slot.width / 2 - visual.x - visual.width / 2) };
        }));
        expect(Math.max(...slots.map(s => s.center)) - Math.min(...slots.map(s => s.center))).toBeLessThanOrEqual(1);
        expect(slots.every(s => s.dx <= 1 && s.dy <= 1)).toBe(true);
        await expect(page.locator('.desktop-settings .setting-chevron')).toHaveCount(2);
        expect(await page.locator('.desktop-settings .setting-chevron').evaluateAll(els => els.every(el => el.tagName.toLowerCase() === 'svg'))).toBe(true);
        await page.getByRole('switch', { name: 'Giảm chuyển động' }).click();
        const insets = await page.locator('.popover-options').evaluate(panel => {
          const left = panel.getBoundingClientRect().left + panel.clientLeft;
          return Array.from(panel.querySelectorAll('h2, h3, .setting-row > span:first-child, .setting-help, .setting-face small'), element => {
            const text = document.createRange();
            text.selectNodeContents(element);
            return text.getBoundingClientRect().left - left;
          });
        });
        expect(insets.length).toBeGreaterThan(10);
        expect(insets.every(inset => Math.abs(inset - 24) <= 1)).toBe(true);
        await withinViewport(page);
        await page.keyboard.press('Escape');
        await page.getByRole('button', { name: /^Chọn âm thanh/ }).click(); await page.getByRole('tab', { name: 'Trộn', exact: true }).click();
        const mix = await page.locator('.mix-level').evaluateAll(els => els.map(el => { const a = el.querySelector('input')!.getBoundingClientRect(), b = el.querySelector('output')!.getBoundingClientRect(); return { h: a.height, dy: Math.abs(a.y + a.height / 2 - b.y - b.height / 2), right: b.right }; }));
        expect(mix.every(m => m.h === 44 && m.dy <= 1)).toBe(true); expect(new Set(mix.map(m => m.right)).size).toBe(1);
        await withinViewport(page);
      } finally { await context.close(); }
    });
  }
}

test('favorite cards keep equal actions and return focus after rename/cancel/delete', async ({page}) => {
  await fallback(page);await page.goto('/');await button(page,'Tùy chọn').click();await button(page,'Phiên yêu thích').click();
  const name='Một phiên thư giãn với tên khá dài';await page.getByLabel('Lưu cấu hình hiện tại',{exact:true}).fill(name);await button(page,'Lưu').click();
  const card=page.getByRole('article',{name,exact:true});
  const sizes=await card.locator('.favorite-actions button').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return{w:r.width,h:r.height,fits:el.scrollWidth<=el.clientWidth};}));
  expect(sizes).toHaveLength(4);expect(Math.max(...sizes.map(s=>s.w))-Math.min(...sizes.map(s=>s.w))).toBeLessThanOrEqual(1);expect(sizes.every(s=>s.h===44&&s.fits)).toBe(true);
  await card.getByRole('button',{name:'Đổi tên',exact:true}).focus();await page.keyboard.press('Enter');await expect(page.getByLabel('Đổi tên phiên',{exact:true})).toBeFocused();await expect(card.locator('.favorite-actions')).toHaveCount(0);
  const { field, save, cancel } = await card.locator('.favorite-rename .inline-fields').evaluate(element => {
    const [field, save, cancel] = Array.from(element.children, child => child.getBoundingClientRect().toJSON());
    return { field, save, cancel };
  });
  expect(save.y).toBeGreaterThanOrEqual(field.y+field.height+7);expect(save.width).toBeCloseTo(cancel.width,0);expect(save.height).toBe(44);expect(field.width).toBeCloseTo(save.width+cancel.width+8,0);
  await page.getByRole('dialog').screenshot({path:'/tmp/em-polish-rename.png',animations:'disabled'});
  await button(page,'Hủy').click();await expect(card.getByRole('button',{name:'Đổi tên',exact:true})).toBeFocused();
  await card.getByRole('button',{name:'Đổi tên',exact:true}).click();await page.getByLabel('Đổi tên phiên',{exact:true}).fill('Đã đổi tên');await button(page,'Lưu tên').click();
  const renamed=page.getByRole('article',{name:'Đã đổi tên',exact:true});await expect(renamed.getByRole('button',{name:'Đổi tên',exact:true})).toBeFocused();
  await renamed.getByRole('button',{name:'Xóa',exact:true}).click();await expect(button(page,'Hủy')).toBeFocused();await expect(renamed.locator('.favorite-actions')).toHaveCount(0);
  await button(page,'Hủy').press('Enter');await expect(renamed.getByRole('button',{name:'Xóa',exact:true})).toBeFocused();await renamed.getByRole('button',{name:'Xóa',exact:true}).click();await button(page,'Xác nhận xóa').click();await expect(page.getByLabel('Lưu cấu hình hiện tại',{exact:true})).toBeFocused();await expect(page.getByRole('article')).toHaveCount(0);await withinViewport(page);await button(page,'Quay lại Tùy chọn').click();await expect(page.getByRole('dialog',{name:'Tùy chọn',exact:true})).toBeVisible();
});

test('keyboard focus stays visible without a second ring; high contrast retains field focus',async({page})=>{
  await fallback(page);await page.goto('/');await page.keyboard.press('Tab');const play=button(page,'Bắt đầu thư giãn');await expect(play).toBeFocused();
  expect(await play.evaluate(el=>{const s=getComputedStyle(el);return el.matches(':focus-visible')&&s.outlineStyle==='solid'&&s.outlineWidth==='2px'&&s.outlineOffset==='2px';})).toBe(true);
  await button(page,'Tùy chọn').click();const slow=page.getByRole('radio',{name:'Chậm',exact:true});await slow.focus();await slow.press('ArrowRight');await expect(page.getByRole('radio',{name:'Vừa',exact:true})).toBeChecked();
  const ring=await page.getByRole('radio',{name:'Vừa',exact:true}).evaluate(el=>{const s=getComputedStyle(el.nextElementSibling!);return {w:s.outlineWidth,offset:s.outlineOffset};});expect(ring).toEqual({w:'2px',offset:'2px'});
  await page.keyboard.press('Escape');await page.getByRole('button',{name:/^Hẹn giờ:/}).click();await page.emulateMedia({forcedColors:'active'});const field=page.getByLabel('Số phút tùy chỉnh',{exact:true});await field.focus();
  const high=await field.evaluate(el=>{const s=getComputedStyle(el);return{w:s.outlineWidth,style:s.outlineStyle,shadow:s.boxShadow};});expect(high.w).toBe('2px');expect(high.style).toBe('solid');expect(high.shadow).toBe('none');
});
