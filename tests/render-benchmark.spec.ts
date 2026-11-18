import { expect, test } from "@playwright/test";
import { measureFrameIntervals, renderExperiment } from "../src/scene/renderBenchmark";

test("render experiments are opt-in and change only the requested setting", () => {
  expect(renderExperiment("?render=both")).toEqual({ enabled: false, mode: "baseline", scale: 1, shadowInterval: 0 });
  expect(renderExperiment("?qa=1&render=unknown")).toEqual({ enabled: true, mode: "baseline", scale: 1, shadowInterval: 0 });
  expect(renderExperiment("?qa=1&render=scale90")).toMatchObject({ mode: "scale90", scale: 0.9, shadowInterval: 0 });
  expect(renderExperiment("?qa=1&render=shadow30")).toMatchObject({ mode: "shadow30", scale: 1, shadowInterval: 1000 / 30 });
  expect(renderExperiment("?qa=1&render=both")).toMatchObject({ mode: "both", scale: 0.9, shadowInterval: 1000 / 30 });
});

test("render metrics count intervals rather than averaging per-frame FPS", () => {
  const samples = [...Array<number>(19).fill(16), 32].map((intervalMs, index) => ({
    mode: "playing", at: index * intervalMs, intervalMs, submitMs: 2, drawCalls: 1, triangles: 2,
  }));
  expect(measureFrameIntervals([])).toBeNull();
  expect(measureFrameIntervals(samples)).toEqual({
    frames: 20, fps: 20000 / (19 * 16 + 32), p95Ms: 16, over25MsPercent: 5,
  });
});
