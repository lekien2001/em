export type Placement = {
  x: number;
  z: number;
  kind: string;
  scale: number;
  yaw: number;
};
import { creekCenter, creekWidth, smoothRange } from "../terrain";
export function cellRandom(P: number, A: number, i: number = 177) {
  let I =
    (Math.imul(P, 374761393) +
      Math.imul(A, 668265263) +
      Math.imul(i, 1442695041)) |
    0;
  I = Math.imul(I ^ (I >>> 13), 1274126177);
  return ((I ^ (I >>> 16)) >>> 0) / 4294967296;
}
export function segmentDistance(
  P: number,
  A: number,
  i: number,
  I: number,
  E: number,
  e: number,
) {
  let g = E - i,
    s = e - I,
    o = Math.max(0, Math.min(1, ((P - i) * g + (A - I) * s) / (g * g + s * s)));
  return Math.hypot(P - i - o * g, A - I - o * s);
}
export function sheepPathDistance(P: number, A: number) {
  return Math.min(
    segmentDistance(P, A, -7, -2.8, -1.9, -0.75),
    segmentDistance(P, A, -1.9, -0.75, 2.25, 0.8),
    segmentDistance(P, A, 2.25, 0.8, 10.3, -7.4),
  );
}
export function* grassCells(P: number) {
  let { inner: A, outer: i, spacing: I } = GRASS_BANDS[P],
    E = Math.ceil(i / I);
  for (let e = -E; e <= E; e++)
    for (let g = -E; g <= E; g++) {
      let s = (g + 0.5 + (cellRandom(g, e, P + 5) - 0.5) * 0.88) * I,
        o = (e + 0.5 + (cellRandom(g, e, P + 9) - 0.5) * 0.88) * I,
        Q = s + 0.16 * Math.sin(o * 0.31) + 0.08 * Math.cos(s * 0.37),
        w = o + 0.15 * Math.sin(s * 0.28) + 0.08 * Math.cos(o * 0.41),
        t = Math.hypot(Q, w);
      if (
        t < A ||
        t > i ||
        Math.abs(Q - creekCenter(w)) < creekWidth(w) + 0.035
      )
        continue;
      let D =
          (A === 0 ? 1 : smoothRange(A, A + 4, t)) *
          (1 - smoothRange(i - 5, i, t)),
        B = smoothRange(
          creekWidth(w) + 0.035,
          creekWidth(w) + 0.85,
          Math.abs(Q - creekCenter(w)),
        ),
        M = 0.48 + 0.52 * smoothRange(0.4, 1.8, sheepPathDistance(Q, w)),
        r = 0.83 + 0.17 * Math.sin(Q * 0.34 + Math.sin(w * 0.2)),
        v = (Math.atan2(Q, w) + Math.PI * 2) % (Math.PI * 2);
      yield {
        x: Q,
        z: w,
        variant: Math.floor(cellRandom(g, e, P + 31) * 3),
        height: D * (0.58 + 0.42 * B) * M * r,
        band: P,
        sector: Math.min(7, Math.floor(v / (Math.PI / 4))),
      };
    }
}
export function flowerPlacements() {
  let P: Placement[] = [];
  FLOWER_PATCHES.forEach((A, i) => {
    let E = Math.ceil((A.rx * 1.35) / 0.76),
      e = Math.ceil((A.rz * 1.35) / 0.76);
    for (let g = -e; g <= e; g++)
      for (let s = -E; s <= E; s++) {
        let o =
            A.x +
            (s + (cellRandom(s, g, i + 73) - 0.5) * 0.94) * 0.76 +
            0.2 * Math.sin(g * 0.8),
          Q =
            A.z +
            (g + (cellRandom(s, g, i + 89) - 0.5) * 0.94) * 0.76 +
            0.2 * Math.cos(s * 0.7),
          w = 1 + 0.1 * Math.sin((o - A.x) * 1.2 + (Q - A.z) * 0.8),
          t = Math.hypot((o - A.x) / A.rx, (Q - A.z) / A.rz) / w;
        if (
          t > 1.3 ||
          sheepPathDistance(o, Q) < 2.5 ||
          (Math.abs(o) < 4.8 && Math.abs(Q) < 3.5) ||
          Math.abs(o - creekCenter(Q)) < creekWidth(Q) + 0.65
        )
          continue;
        let D = cellRandom(s, g, i + 107);
        if (D > 1 - smoothRange(0.45, 1.3, t)) continue;
        let B = t > 0.72 ? "low" : D < 0.4 ? "tall" : "wide";
        P.push({
          x: o,
          z: Q,
          kind: B,
          scale: (0.6 + cellRandom(s, g, i + 109) * 0.52) * (1 - t * 0.2),
          yaw: cellRandom(s, g, i + 113) * Math.PI * 2,
        });
      }
  });
  return P;
}
export const TREE_CENTERS = [
  [-26, -24],
  [26, -30],
  [-5, -43],
  [-34, 27],
  [33, 30],
  [2, 49],
];
export const TREE_PLACEMENTS = TREE_CENTERS.flatMap(([P, A], i) => [
  {
    x: P,
    z: A,
    scale: i < 2 ? 1.65 : 1.18,
    yaw: i * 0.91,
    kind: i % 2 ? "lean" : "broad",
  },
  {
    x: P - 4.7,
    z: A - 2.4,
    scale: 0.92 + (i % 3) * 0.08,
    yaw: i * 1.8 + 0.5,
    kind: "lean",
  },
  {
    x: P + 3.8,
    z: A + 2.9,
    scale: 0.74 + (i % 2) * 0.1,
    yaw: i * 0.7 + 2,
    kind: "compact",
  },
]);
export const GRASS_BANDS = [
  {
    inner: 0,
    outer: 30,
    spacing: 0.25,
    blades: 7,
    segments: 3,
  },
  {
    inner: 26,
    outer: 66,
    spacing: 0.42,
    blades: 5,
    segments: 2,
  },
  {
    inner: 60,
    outer: 110,
    spacing: 0.85,
    blades: 3,
    segments: 1,
  },
];
export const FLOWER_PATCHES = [
  {
    x: -10,
    z: 5,
    rx: 3.7,
    rz: 2.1,
  },
  {
    x: 9,
    z: 7,
    rx: 3.2,
    rz: 2.3,
  },
  {
    x: -12,
    z: -8,
    rx: 3.4,
    rz: 2.4,
  },
  {
    x: 7,
    z: -14,
    rx: 3.4,
    rz: 2.8,
  },
  {
    x: -15,
    z: 14,
    rx: 3.5,
    rz: 2.8,
  },
  ...[-24, -10, 3, 17, 33].flatMap((P) =>
    [-1, 1].map((A) => ({
      x: creekCenter(P) + A * (creekWidth(P) + 2.4),
      z: P,
      rx: 1.65,
      rz: 3.2,
    })),
  ),
  ...TREE_PLACEMENTS.filter((P, A) => A % 3 === 0).map((P) => ({
    x: P.x + 1,
    z: P.z + 1,
    rx: 3.6,
    rz: 2.4,
  })),
];
