export type Point2 = {
  x: number;
  z: number;
};
export type Barn = Point2 & {
  id: "entry" | "exit";
  yaw: number;
};
export function barnLocal(barn: Barn, x: number, z: number) {
  let I = x - barn.x,
    E = z - barn.z,
    e = Math.cos(barn.yaw),
    g = Math.sin(barn.yaw);
  return {
    x: e * I - g * E,
    z: g * I + e * E,
  };
}
export function barnPoint(barn: Barn, x: number, z: number) {
  let I = Math.cos(barn.yaw),
    E = Math.sin(barn.yaw);
  return {
    x: barn.x + I * x + E * z,
    z: barn.z - E * x + I * z,
  };
}
export function barnDistance(barn: Barn, x: number, z: number) {
  let I = barnLocal(barn, x, z);
  return Math.max(
    Math.abs(I.x) - BARN_WIDTH / 2,
    Math.abs(I.z) - BARN_DEPTH / 2,
  );
}
export function inBarn(x: number, z: number, margin: number = 0) {
  return BARNS.some((I) => barnDistance(I, x, z) < margin);
}
export function clearBarnPlant<T extends Point2>(placement: T) {
  let A = placement;
  for (let i of BARNS) {
    if (barnDistance(i, A.x, A.z) >= 0.65) continue;
    let I = barnLocal(i, A.x, A.z),
      E = BARN_WIDTH / 2 + 0.8,
      e = -BARN_DEPTH / 2 - 0.8;
    E - Math.abs(I.x) < I.z - e ? (I.x = I.x < 0 ? -E : E) : (I.z = e);
    A = {
      ...A,
      ...barnPoint(i, I.x, I.z),
    };
  }
  return A;
}
export const JUMP_YAW = Math.atan2(2, 0.8);
export const BARN_WIDTH = 4.2;
export const BARN_DEPTH = 4.8;
export const DOOR_WIDTH = 2.8;
export const DOOR_HEIGHT = 2.55;
export const BARNS: Barn[] = [
  {
    id: "entry",
    x: -9.4,
    z: -3.9,
    yaw: JUMP_YAW,
  },
  {
    id: "exit",
    x: 7.3,
    z: -7.7,
    yaw: Math.atan2(-0.48, 0.88),
  },
];
