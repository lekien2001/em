import type { Object3D, PerspectiveCamera, Vector3 } from "three";
export function selectDetail(
  P: number,
  A: number | undefined,
  i: number[],
  I: number = 0.15,
) {
  if (A === void 0) {
    let e = 0;
    for (; e < i.length && P < i[e]; ) e++;
    return e;
  }
  let E = A;
  for (; E < i.length && P < i[E] * (1 - I); ) E++;
  for (; E > 0 && P > i[E - 1] * (1 + I); ) E--;
  return E;
}
export class ScreenDetail {
  constructor(A: Object3D[], i: Vector3, I: number, E: number[]) {
    this.levels = A;
    this.center = i;
    this.size = I;
    this.thresholds = E;
    A.forEach((e, g) => (e.visible = g === 0));
  }
  levels: Object3D[];
  center: Vector3;
  size: number;
  thresholds: number[];
  current: number | undefined;
  update(A: PerspectiveCamera, i: number) {
    let I = Math.max(0.1, A.position.distanceTo(this.center)),
      E = (this.size * i * 0.5 * A.projectionMatrix.elements[5]) / I,
      e = selectDetail(E, this.current, this.thresholds);
    e !== this.current &&
      (this.levels.forEach((g, s) => (g.visible = s === e)),
      (this.current = e));
  }
}
