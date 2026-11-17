import { barnDistance, BARNS } from "./barnLayout";
export function smoothRange(from: number, to: number, value: number) {
  let I = terrainClamp((value - from) / (to - from));
  return I * I * (3 - 2 * I);
}
export function creekCenter(z: number) {
  return 14.6 + 3.2 * Math.sin(z * 0.067 + 0.6) + Math.sin(z * 0.14 - 0.3);
}
export function creekWidth(z: number) {
  return 1.18 + 0.29 * Math.sin(z * 0.1 + 0.4) + 0.16 * Math.cos(z * 0.23);
}
export function rawMeadowHeight(x: number, z: number) {
  let i = Math.hypot(x, z),
    I = Math.atan2(z, x),
    E = 0.24 * Math.sin(x * 0.085 + 0.5) * Math.cos(z * 0.075),
    e = (2.4 + 1.4 * Math.cos(I * 3 + 0.8)) * Math.exp(-(((i - 39) / 15) ** 2)),
    g = (8 + 3.5 * Math.sin(I * 2 + 0.7)) * Math.exp(-(((i - 88) / 25) ** 2)),
    s = (16 + 5 * Math.sin(I * 3 - 1.2)) * Math.exp(-(((i - 160) / 40) ** 2)),
    o =
      2.5 * Math.sin(x * 0.026 + 0.8) * Math.cos(z * 0.03 - 0.5) +
      1.8 * Math.cos(x * 0.046 + z * 0.018),
    Q = 0;
  return (
    -0.15 +
    smoothRange(8, 24, i) * E +
    smoothRange(15, 42, i) * (e + g + s + smoothRange(45, 100, i) * o) +
    Q * smoothRange(4, 11, i) * smoothRange(3, 7, Math.abs(z))
  );
}
export function meadowHeight(x: number, z: number) {
  let i = rawMeadowHeight(x, z);
  for (let I of BARN_PADS) {
    let E = 1 - smoothRange(0, 1.2, barnDistance(I.barn, x, z));
    i += (I.height - i) * E;
  }
  return i;
}
export function groundHeight(x: number, z: number) {
  let i = Math.abs(x - creekCenter(z)),
    I = creekWidth(z),
    E =
      i < I
        ? 0.38 + 0.3 * (1 - (i / I) ** 2)
        : 0.38 * (1 - smoothRange(I, I + 1.6, i));
  return meadowHeight(x, z) - E;
}
export function minimumCameraHeight(x: number, z: number) {
  return groundHeight(x, z) + 1.35;
}
export const TERRAIN_RADIUS = 420;
export const FOG_NEAR = 48;
export const FOG_FAR = 148;
export const terrainClamp = (P: number) => Math.max(0, Math.min(1, P));
export const BARN_PADS = BARNS.map((P) => ({
  barn: P,
  height: P.id === "exit" ? rawMeadowHeight(0, 0) : rawMeadowHeight(P.x, P.z),
}));
