import type { Point2 } from "../barnLayout";
import { BARNS, JUMP_YAW, barnPoint } from "../barnLayout";
import type { Pose } from "./natural";
export function crossingCount(phase: number) {
  let A = 0;
  for (let i = 0; i < 3; i++)
    A += Math.max(0, Math.floor((phase - (7.6 + i * 6)) / SHEEP_CYCLE) + 1);
  return A;
}
export function hermite(
  from: number,
  to: number,
  fromVelocity: number,
  toVelocity: number,
  duration: number,
  time: number,
) {
  let g = time * time,
    s = g * time;
  return (
    (2 * s - 3 * g + 1) * from +
    (s - 2 * g + time) * duration * fromVelocity +
    (-2 * s + 3 * g) * to +
    (s - g) * duration * toVelocity
  );
}
export function hermiteDerivative(
  from: number,
  to: number,
  fromVelocity: number,
  toVelocity: number,
  duration: number,
  time: number,
) {
  return (
    ((6 * time * time - 6 * time) * from +
      (3 * time * time - 4 * time + 1) * duration * fromVelocity +
      (-6 * time * time + 6 * time) * to +
      (3 * time * time - 2 * time) * duration * toVelocity) /
    duration
  );
}
export function createArcPath(
  start: number,
  end: number,
  from: Point2,
  to: Point2,
  fromVelocity: Point2,
  toVelocity: Point2,
) {
  let g = end - start,
    s = (w: number) => ({
      x: hermite(from.x, to.x, fromVelocity.x, toVelocity.x, g, w),
      z: hermite(from.z, to.z, fromVelocity.z, toVelocity.z, g, w),
      vx: hermiteDerivative(from.x, to.x, fromVelocity.x, toVelocity.x, g, w),
      vz: hermiteDerivative(from.z, to.z, fromVelocity.z, toVelocity.z, g, w),
    }),
    o = [0],
    Q = s(0);
  for (let w = 1; w <= 256; w++) {
    let t = s(w / 256);
    o.push(o[w - 1] + Math.hypot(t.x - Q.x, t.z - Q.z));
    Q = t;
  }
  return {
    sample(w: number) {
      let t = clamp01((w - start) / g),
        D = s(t),
        B = t * 256,
        M = Math.min(255, Math.floor(B));
      return {
        ...D,
        distance: o[M] + (o[M + 1] - o[M]) * (B - M),
      };
    },
    length: o[256],
  };
}
export function sheepAge(phase: number, index: number) {
  let i = phase - index * 6;
  return i < 0 ? -1 : ((i % SHEEP_CYCLE) + SHEEP_CYCLE) % SHEEP_CYCLE;
}
export function barnDoors(phase: number) {
  let A = 0,
    i = 0;
  for (let I = 0; I < 3; I++) {
    let E = sheepAge(phase, I);
    E < 0 ||
      ((A = Math.max(A, ease((E - 0.35) / 0.7) * (1 - ease((E - 4) / 0.7)))),
      (i = Math.max(i, ease((E - 13) / 0.7) * (1 - ease((E - 16.6) / 0.7)))));
  }
  return {
    entry: A,
    exit: i,
  };
}
export function sheepPose(phase: number, index: number): Pose {
  let i = sheepAge(phase, index),
    I = {
      y: 0,
      visible: i >= 0,
    };
  if (i < 0.8)
    return {
      ...I,
      state: "Idle",
      clipTime: Math.max(0, i),
      x: ENTRY_BARN.x,
      z: ENTRY_BARN.z,
      yaw: ENTRY_YAW,
    };
  if (i < 6.4) {
    let g = APPROACH_PATH.sample(i);
    return {
      ...I,
      state: "Walk",
      clipTime: (g.distance / 1.05) % 1,
      x: g.x,
      z: g.z,
      yaw: Math.hypot(g.vx, g.vz) > 1e-7 ? Math.atan2(g.vx, g.vz) : ENTRY_YAW,
    };
  }
  if (i < 8.8) {
    let g = (i - 6.4) / 2.4,
      s = g < 0.5,
      o = s ? g * 2 : (g - 0.5) * 2,
      Q = s
        ? hermite(-1.9, 0, 5.1 / 6.4, 2, 1.2, o)
        : hermite(0, 1.9, 2, 0.7, 1.2, o),
      w = s
        ? hermite(-0.75, 0, 2.05 / 6.4, 0.8, 1.2, o)
        : hermite(0, 0.75, 0.8, 0.1, 1.2, o),
      t = 1.85 * 16 * g * g * (1 - g) * (1 - g);
    return {
      ...I,
      state: "Jump",
      clipTime: i - 6.4,
      x: Q,
      z: w,
      y: t,
      yaw: JUMP_YAW,
    };
  }
  if (i < 9.3) {
    let g = (i - 8.8) / 0.5;
    return {
      ...I,
      state: "Land",
      clipTime: i - 8.8,
      x: hermite(1.9, 2.25, 0.7, 6.6 / 7.5, 0.5, g),
      z: hermite(0.75, 0.8, 0.1, 0, 0.5, g),
      yaw: JUMP_YAW + (Math.PI / 2 - JUMP_YAW) * ease(g),
    };
  }
  if (i >= 16.2)
    return {
      ...I,
      state: "Idle",
      clipTime: i - 16.2,
      x: EXIT_BARN.x,
      z: EXIT_BARN.z,
      yaw: EXIT_BARN.yaw + Math.PI,
    };
  let E = i < 13.7 ? RETURN_PATH.sample(i) : ENTRANCE_PATH.sample(i),
    e = i < 13.7 ? E.distance : RETURN_PATH.length + E.distance;
  return {
    ...I,
    state: "Walk",
    clipTime: (e / 1.05) % 1,
    x: E.x,
    z: E.z,
    yaw: Math.atan2(E.vx, E.vz),
  };
}
export const SHEEP_CYCLE = 18;
export const INITIAL_PHASE = 4.4;
export class SceneClock {
  activeSeconds = 0;
  phase = INITIAL_PHASE;
  running = false;
  rate = 1;
  anchor;
  reported = 0;
  constructor(A: number) {
    this.anchor = A;
  }
  sample(A: number) {
    if (this.running) {
      const dt = Math.max(0, A - this.anchor) / 1000;
      this.phase += dt * this.rate;
      this.activeSeconds += dt;
    }
    this.anchor = A;
    const count = crossingCount(this.phase),
      crossings = count - this.reported;
    this.reported = count;
    return {
      phase: this.phase,
      crossings,
      activeSeconds: this.activeSeconds,
    };
  }
  configure(A: number, i: boolean, I: number) {
    let E = this.sample(A);
    this.running = i;
    this.rate = I;
    return E;
  }
  reset(A: number) {
    this.phase = INITIAL_PHASE;
    this.anchor = A;
    this.reported = 0;
    this.activeSeconds = 0;
  }
}
export const clamp01 = (P: number) => Math.max(0, Math.min(1, P));
export const ease = (P: number) => ((P = clamp01(P)), P * P * (3 - 2 * P));
export const ENTRY_BARN = BARNS[0];
export const EXIT_BARN = BARNS[1];
export const ZERO_VELOCITY = {
  x: 0,
  z: 0,
};
export const APPROACH_PATH = createArcPath(
  0.8,
  6.4,
  ENTRY_BARN,
  {
    x: -1.9,
    z: -0.75,
  },
  ZERO_VELOCITY,
  {
    x: 5.1 / 6.4,
    z: 2.05 / 6.4,
  },
);
export const INITIAL_TANGENT = APPROACH_PATH.sample(0.80001);
export const ENTRY_YAW = Math.atan2(INITIAL_TANGENT.vx, INITIAL_TANGENT.vz);
export const EXIT_APPROACH = barnPoint(EXIT_BARN, 0, 4.6);
export const EXIT_TANGENT = {
  x: -Math.sin(EXIT_BARN.yaw) * 1.7,
  z: -Math.cos(EXIT_BARN.yaw) * 1.7,
};
export const RETURN_PATH = createArcPath(
  9.3,
  13.7,
  {
    x: 2.25,
    z: 0.8,
  },
  EXIT_APPROACH,
  {
    x: 6.6 / 7.5,
    z: 0,
  },
  EXIT_TANGENT,
);
export const ENTRANCE_PATH = createArcPath(
  13.7,
  16.2,
  EXIT_APPROACH,
  EXIT_BARN,
  EXIT_TANGENT,
  ZERO_VELOCITY,
);
