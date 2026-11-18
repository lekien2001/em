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

async function alignedPanel(panel: Locator, leftEdges: string, rightEdges: string) {
  const layout = await panel.evaluate((element, { leftEdges, rightEdges }) => {
    const frame = element.getBoundingClientRect();
    const content = element.querySelector('.popover-content')!.getBoundingClientRect();
    const heading = element.querySelector('h2')!.getBoundingClientRect();
    const close = element.querySelector<HTMLButtonElement>('.popover-close')!;
    const back = element.querySelector<HTMLButtonElement>('.popover-back');
    const iconEdge = (button: HTMLButtonElement, right: boolean) => {
      const icon = button.querySelector('svg')!;
      const mark = icon.getBBox();
      const radius = Number(icon.getAttribute('stroke-width')) / 2;
      const x = right ? mark.x + mark.width + radius : mark.x - radius;
      return new DOMPoint(x, 0).matrixTransform(icon.getScreenCTM()!).x;
    };
    const rightInset = frame.right - iconEdge(close, true);
    const leftInset = (back ? iconEdge(back, false) : heading.left) - frame.left;
    const edgeErrors = (selector: string, edge: 'left' | 'right', target: number) =>
      Array.from(element.querySelectorAll(selector), child => Math.abs(child.getBoundingClientRect()[edge] - target));
    return {
      closeWidth: close.offsetWidth,
      closeHeight: close.offsetHeight,
      backSize: back && [back.offsetWidth, back.offsetHeight],
      titleFits: !back || (heading.left > back.getBoundingClientRect().right && heading.right < close.getBoundingClientRect().left),
      leftErrors: edgeErrors(leftEdges, 'left', content.left),
      rightErrors: edgeErrors(rightEdges, 'right', content.right),
      closeError: Math.abs(rightInset - leftInset),
      scrolls: element.scrollHeight > element.clientHeight,
    };
  }, { leftEdges, rightEdges });
  expect(layout.closeWidth).toBe(44);
  expect(layout.closeHeight).toBe(44);
  if (layout.backSize) expect(layout.backSize).toEqual([44, 44]);
  expect(layout.titleFits).toBe(true);
  expect(layout.closeError).toBeLessThanOrEqual(1);
  expect(layout.leftErrors.length).toBeGreaterThan(0);
  expect(layout.rightErrors.length).toBeGreaterThan(0);
  expect(Math.max(...layout.leftErrors, ...layout.rightErrors)).toBeLessThanOrEqual(1);
  return layout;
}

const settingsLeftEdges = '.desktop-settings h3, .setting-row > span:first-child, .setting-help, .setting-face small';
const favoritesLeftEdges = '.favorites-panel > p, .favorites-panel form > label, #favorite-name, .favorite-card';
const timerLeftEdges = '.timer-remaining > span, .compact-timers, .custom-timer label, #custom-minutes, .timer-extend, .timer-controls > .popover-note, .fade-options legend';
const timerRightEdges = '.timer-remaining > strong, .compact-timers, .custom-timer .inline-fields, .timer-extend';

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
        const timerTrigger = page.getByRole('button', { name: /^Hẹn giờ:/ });
        await timerTrigger.click();
        const timerPanel = page.getByRole('dialog', { name: 'Hẹn giờ' });
        await alignedPanel(timerPanel, timerLeftEdges, timerRightEdges);
        const durations = page.locator('.compact-timers button');
        for (const minutes of [15, 30, 60, 0]) {
          const preset = button(page, minutes ? `${minutes} phút` : 'Không giới hạn');
          await preset.click();
          await expect(preset).toHaveAttribute('aria-pressed', 'true');
          await expect(durations.locator('svg')).toHaveCount(0);
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
        await timerPanel.getByRole('button', { name: 'Đóng' }).click();
        await expect(timerTrigger).toBeFocused();
        const settingsTrigger = button(page, 'Tùy chọn');
        await settingsTrigger.click();
        const settingsPanel = page.getByRole('dialog', { name: 'Tùy chọn' });
        const speed = await settingsPanel.locator('.speed-segments label > span').evaluateAll(segments => segments.map(segment => {
          const cell = segment.getBoundingClientRect();
          const text = document.createRange();
          text.selectNodeContents(segment);
          const label = text.getBoundingClientRect();
          return {
            width: cell.width, height: cell.height,
            dx: Math.abs((cell.left + cell.right - label.left - label.right) / 2),
            dy: Math.abs((cell.top + cell.bottom - label.top - label.bottom) / 2),
          };
        }));
        expect(speed).toHaveLength(2);
        expect(Math.abs(speed[0].width - speed[1].width)).toBeLessThanOrEqual(1);
        expect(speed.every(cell => cell.height === 44 && cell.dx <= 1 && cell.dy <= 1)).toBe(true);
        const slots = await page.locator('.desktop-settings .setting-slot').evaluateAll(els => els.map(el => {
          const row = el.parentElement!.getBoundingClientRect(), slot = el.getBoundingClientRect(), visual = el.firstElementChild!.getBoundingClientRect();
          return { center: slot.x + slot.width / 2, dy: Math.abs(row.y + row.height / 2 - visual.y - visual.height / 2), dx: Math.abs(slot.x + slot.width / 2 - visual.x - visual.width / 2) };
        }));
        expect(Math.max(...slots.map(s => s.center)) - Math.min(...slots.map(s => s.center))).toBeLessThanOrEqual(1);
        expect(slots.every(s => s.dx <= 1 && s.dy <= 1)).toBe(true);
        await expect(page.locator('.desktop-settings .setting-chevron')).toHaveCount(2);
        expect(await page.locator('.desktop-settings .setting-chevron').evaluateAll(els => els.every(el => el.tagName.toLowerCase() === 'svg'))).toBe(true);
        await page.getByRole('switch', { name: 'Giảm chuyển động' }).click();
        await alignedPanel(settingsPanel, settingsLeftEdges, '.setting-slot, .speed-segments');
        const rowInsets = await settingsPanel.locator('.setting-row').evaluateAll(rows => rows.map(row => {
          const style = getComputedStyle(row);
          return [style.paddingLeft, style.paddingRight];
        }));
        expect(rowInsets.length).toBeGreaterThan(0);
        expect(rowInsets.every(([left, right]) => left === '8px' && right === '8px')).toBe(true);
        await settingsPanel.getByRole('button', { name: 'Phiên yêu thích' }).click();
        const favoritesPanel = page.getByRole('dialog', { name: 'Phiên yêu thích' });
        await expect(favoritesPanel.locator('.popover-heading').getByRole('button', { name: 'Quay lại Tùy chọn' })).toBeVisible();
        await expect(favoritesPanel.locator('.favorites-panel').getByRole('button', { name: 'Quay lại Tùy chọn' })).toHaveCount(0);
        await alignedPanel(favoritesPanel, favoritesLeftEdges, '.favorites-panel .inline-fields');
        await withinViewport(page);
        await page.keyboard.press('Escape');
        await expect(settingsTrigger).toBeFocused();
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
  await alignedPanel(page.getByRole('dialog', { name: 'Phiên yêu thích' }), favoritesLeftEdges, '.favorites-panel .inline-fields, .favorite-card');
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

test('short desktop popovers keep symmetrical content while scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 390 });
  await fallback(page);
  await page.goto('/');
  const settingsTrigger = button(page, 'Tùy chọn');
  await settingsTrigger.click();
  const settings = page.getByRole('dialog', { name: 'Tùy chọn' });
  expect((await alignedPanel(settings, settingsLeftEdges, '.setting-slot, .speed-segments')).scrolls).toBe(true);
  const openFavorites = settings.getByRole('button', { name: 'Phiên yêu thích' });
  await openFavorites.hover({ position: { x: 4, y: 22 } });
  await expect.poll(() => openFavorites.evaluate(element => getComputedStyle(element).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
  await openFavorites.press('Enter');
  const favorites = page.getByRole('dialog', { name: 'Phiên yêu thích' });
  expect((await alignedPanel(favorites, favoritesLeftEdges, '.favorites-panel .inline-fields')).scrolls).toBe(true);
  const back = favorites.getByRole('button', { name: 'Quay lại Tùy chọn' });
  await page.keyboard.press('Tab');
  await expect(back).toBeFocused();
  await expect(back).toHaveCSS('outline-style', 'solid');
  await page.keyboard.press('Enter');
  await expect(settings).toBeVisible();
  await openFavorites.click();
  await favorites.getByRole('button', { name: 'Đóng' }).click();
  await expect(settingsTrigger).toBeFocused();

  const timerTrigger = page.getByRole('button', { name: /^Hẹn giờ:/ });
  await timerTrigger.click();
  const timer = page.getByRole('dialog', { name: 'Hẹn giờ' });
  expect((await alignedPanel(timer, timerLeftEdges, timerRightEdges)).scrolls).toBe(true);
  await timer.getByRole('button', { name: '3 phút', exact: true }).scrollIntoViewIfNeeded();
  expect(await timer.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  await alignedPanel(timer, timerLeftEdges, timerRightEdges);
  await page.keyboard.press('Escape');
  await expect(timerTrigger).toBeFocused();
});

test('touch dialogs keep the timer indicator and favorites back row', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage();
    await fallback(page);
    await page.goto('/');
    await page.getByRole('button', { name: /^Hẹn giờ/ }).tap();
    const timer = page.getByRole('dialog', { name: 'Hẹn giờ' });
    const preset = timer.getByRole('button', { name: '15 phút', exact: true });
    await preset.tap();
    await expect(preset).toHaveAttribute('aria-pressed', 'true');
    await expect(preset.locator('svg')).toBeVisible();
    await timer.getByRole('button', { name: 'Đóng' }).tap();
    await button(page, 'Phiên yêu thích').tap();
    const favorites = page.getByRole('dialog', { name: 'Phiên yêu thích' });
    const back = favorites.locator('.favorites-panel').getByRole('button', { name: 'Quay lại Tùy chọn' });
    await expect(back).toHaveText('Tùy chọn');
    await back.tap();
    await expect(favorites).toHaveCount(0);
  } finally {
    await context.close();
  }
});
