import { test, expect } from "@playwright/test";
import { SessionTimer } from "../src/session/SessionTimer";
import { validFavoriteConfig, formatRemaining, singleMix } from "../src/session/config";
import { normalizeLevels, sampleMix } from "../src/audio/mix";
import { readFavorites, writeFavorites, validateName, FAVORITES_KEY } from "../src/session/favorites";
test("deadline, pause and recovery stay continuous, extension preserves elapsed and configured duration", () => {
  let now = 1000;
  const timer = new SessionTimer(() => now);
  timer.configure(1);
  timer.setFade(15);
  timer.start();
  now += 50000;
  expect(timer.fade).toBeCloseTo(2 / 3);
  expect(timer.remaining).toBe(10000);
  timer.extend(5);
  expect(timer.duration).toBe(6);
  expect(timer.remaining).toBe(310000);
  expect(timer.fade).toBeCloseTo(2 / 3);
  now += 500;
  const before = timer.fade;
  timer.pause();
  expect(timer.fade).toBe(before);
  now += 90000;
  expect(timer.fade).toBe(before);
  expect(timer.remaining).toBe(309500);
  timer.start();
  expect(timer.fade).toBe(before);
  now += 1000;
  expect(timer.fade).toBe(1);
  now += timer.remaining!;
  expect(timer.check()).toBe(true);
  expect(timer.fade).toBe(0);
  expect(timer.ended).toBe(true);
  expect(timer.canExtend(5)).toBe(false);
  timer.start();
  expect(timer.remaining).toBe(360000);
});
test("short fade, infinity, custom caps, paused extension and each fade length", () => {
  let now = 0;
  const t = new SessionTimer(() => now);
  expect(t.canExtend(5)).toBe(false);
  t.configure(1);
  t.setFade(180);
  expect(t.windowMs).toBe(60000);
  t.start();
  now = 30000;
  expect(t.fade).toBe(.5);
  t.pause();
  expect(t.canExtend(5)).toBe(true);
  t.extend(5);
  expect(t.remaining).toBe(330000);
  expect(t.duration).toBe(6);
  t.configure(720);
  expect(t.canExtend(5)).toBe(false);
  expect(() => t.configure(721)).toThrow();
  expect(() => t.configure(1.5)).toThrow();
  t.configure(0);
  expect(t.remaining).toBeNull();
  expect(t.fade).toBe(1);
  expect(t.canExtend(5)).toBe(false);
  for (const fade of [15, 60, 180] as const) {
    t.apply(30, fade);
    t.start();
    now += 1800000 - fade * 500;
    expect(t.fade).toBeCloseTo(.5);
    now += fade * 500;
    t.check();
    expect(t.fade).toBe(0);
  }
  expect(formatRemaining(3599000)).toBe("59:59");
  expect(formatRemaining(3600000)).toBe("1:00:00");
  expect(formatRemaining(43200000)).toBe("12:00:00");
  expect(formatRemaining(null)).toBe("∞");
});
test("changing duration or fade during fade recovers without an immediate jump", () => {
  let now = 0;
  const t = new SessionTimer(() => now);
  t.configure(1);
  t.start();
  now = 55000;
  const before = t.fade;
  t.configure(30);
  expect(t.fade).toBe(before);
  now += 750;
  expect(t.fade).toBeCloseTo((1 + before) / 2);
  now += 750;
  expect(t.fade).toBe(1);
  now += 1800000 - 10000;
  const fading = t.fade;
  t.setFade(180);
  expect(t.fade).toBe(fading);
});
test("normalized mixes and intermediate equal-power curves are bounded", () => {
  for (let i = 0; i <= 1000; i++) {
    const values = sampleMix({
      from: normalizeLevels([1, .6, 0]),
      to: normalizeLevels([.8, 1, 1]),
      at: 0,
      duration: .8,
      equalPower: true
    }, i / 1000);
    expect(Math.hypot(...values)).toBeLessThanOrEqual(1 + 1e-12);
    expect(values.reduce((a, b) => a + b) * .5).toBeLessThan(Math.pow(10, -1 / 20));
  }
});
test("favorites reject malformed storage/configs, duplicates, and report failed persistence", () => {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value)
    }
  });
  const config = {
    mix: singleMix("rain"),
    volume: 0,
    lastVolume: .72,
    duration: 45,
    fadeSeconds: 60 as const,
    speed: "slow" as const,
    reduced: false,
    showCount: false
  };
  expect(validFavoriteConfig(config)).toBe(true);
  expect(validFavoriteConfig({
    ...config,
    mix: {}
  })).toBe(false);
  const entries = [{
    id: "one",
    name: "Ngủ ngon",
    config
  }];
  expect(validateName(" ngủ ngon ", entries)).not.toBe("");
  expect(validateName(" ", [])).not.toBe("");
  expect(validateName("a".repeat(41), [])).not.toBe("");
  expect(writeFavorites(entries)).toBe("");
  expect(readFavorites().entries).toEqual(entries);
  store.set(FAVORITES_KEY, '{"version":1,"entries":[{}]}');
  expect(readFavorites().warning).not.toBe("");
  expect(readFavorites().entries).toEqual([]);
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() {
      throw new Error("blocked");
    }
  });
  expect(writeFavorites(entries)).toContain("lần mở này");
  expect(readFavorites().warning).not.toBe("");
});
