import type { BufferGeometry, Object3D } from "three";
import {
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
  Shape,
  SphereGeometry,
  Vector2,
} from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { AssetLoader } from "../assets/AssetLoader";
import {
  BARN_DEPTH,
  BARN_WIDTH,
  BARNS,
  DOOR_HEIGHT,
  DOOR_WIDTH,
} from "./barnLayout";
import { barnDoors } from "./sheep/timeline";
import { groundHeight } from "./terrain";
type Part = "wood" | "roof" | "floor";
export function buildBarnGeometry() {
  let P: BufferGeometry[] = [],
    A: BufferGeometry[] = [],
    i: BufferGeometry[] = [];
  function I(
    w: BufferGeometry[],
    t: BufferGeometry,
    D = 0,
    B = 0,
    M = 0,
    r = 0,
    v = 1,
  ) {
    if (t.index) {
      let C = t;
      t = t.toNonIndexed();
      C.dispose();
    }
    t.rotateZ(r);
    t.translate(D, B, M);
    t.setAttribute(
      "color",
      new Float32BufferAttribute(
        new Float32Array(t.attributes.position.count * 3).fill(v),
        3,
      ),
    );
    w.push(t);
  }
  let E = (w: number, h: number, d: number, r = 0.065) =>
    new RoundedBoxGeometry(w, h, d, h === 0.2 && d > 5 ? 2 : 1, r);
  for (let w of [-1, 1])
    I(P, E(0.18, 2.8, BARN_DEPTH + 0.08), w * (BARN_WIDTH / 2 - 0.07), 1.36, 0);
  I(P, E(BARN_WIDTH, 2.8, 0.18), 0, 1.36, -BARN_DEPTH / 2 + 0.06);
  for (let w of [-1, 1])
    I(
      P,
      E((BARN_WIDTH - DOOR_WIDTH) / 2 + 0.08, 2.8, 0.18),
      (w * (DOOR_WIDTH + BARN_WIDTH)) / 4,
      1.36,
      BARN_DEPTH / 2 - 0.02,
    );
  I(P, E(DOOR_WIDTH + 0.08, 0.34, 0.2), 0, 2.69, BARN_DEPTH / 2 - 0.02);
  for (let w = 0; w < 7; w++) {
    let t = 0.19 + w * 0.38;
    for (let D of [-1, 1])
      I(
        P,
        E(0.065, 0.355, BARN_DEPTH + 0.04, 0.02),
        D * (BARN_WIDTH / 2 + 0.035),
        t,
        0,
        0,
        0.94 + (w % 3) * 0.025,
      );
    I(
      P,
      E(BARN_WIDTH, 0.355, 0.065, 0.02),
      0,
      t,
      -BARN_DEPTH / 2 - 0.08,
      0,
      0.96,
    );
  }
  let e = new Shape();
  e.moveTo(-BARN_WIDTH / 2, 2.74);
  e.lineTo(BARN_WIDTH / 2, 2.74);
  e.lineTo(0, 3.85);
  e.closePath();
  for (let w of [-1, 1])
    I(
      P,
      new ExtrudeGeometry(e, {
        depth: 0.19,
        bevelEnabled: false,
        steps: 1,
      }),
      0,
      0,
      (w * BARN_DEPTH) / 2 - 0.1,
    );
  let g = Math.atan2(1.11, 2.1),
    s = Math.hypot(2.1, 1.11) + 0.24;
  for (let w of [-1, 1])
    I(A, E(s, 0.2, BARN_DEPTH + 0.55, 0.11), w * 1.07, 3.31, 0, -w * g);
  I(P, E(0.18, 0.18, BARN_DEPTH + 0.6, 0.06), 0, 3.89, 0, 0, 1.06);
  for (let w of [-1, 1]) {
    I(
      P,
      E(0.16, 2.83, 0.22, 0.08),
      (w * DOOR_WIDTH) / 2,
      1.365,
      BARN_DEPTH / 2 + 0.09,
      0,
      1.07,
    );
    I(
      P,
      E(s, 0.18, 0.22, 0.08),
      w * 1.07,
      3.34,
      BARN_DEPTH / 2 + 0.18,
      -w * g,
      1.07,
    );
  }
  I(i, E(BARN_WIDTH + 0.06, 0.12, BARN_DEPTH + 0.06, 0.035), 0, -0.058, 0);
  let o = (w: BufferGeometry[]) => {
    let t = mergeGeometries(w)!;
    w.forEach((D) => D.dispose());
    t.computeBoundingBox();
    return t;
  };
  function Q(w: number) {
    let t: BufferGeometry[] = [],
      D = DOOR_WIDTH / 2;
    I(
      t,
      E(D + 0.025, DOOR_HEIGHT, 0.14, 0.035),
      (w * D) / 2,
      DOOR_HEIGHT / 2,
      0,
    );
    for (let B = 0; B < 3; B++)
      I(
        t,
        E(D / 3 - 0.018, DOOR_HEIGHT - 0.04, 0.035, 0.016),
        w * (((B + 0.5) * D) / 3),
        DOOR_HEIGHT / 2,
        0.083,
        0,
        0.95 + B * 0.025,
      );
    for (let B of [0.5, 2.05])
      I(t, E(0.24, 0.12, 0.06, 0.025), w * 0.14, B, 0.13, 0, 0.32);
    I(t, new SphereGeometry(0.065, 8, 6), w * (D - 0.18), 1.18, 0.16, 0, 0.48);
    return o(t);
  }
  I(P, E(BARN_WIDTH, 0.1, BARN_DEPTH), 0, 2.73, 0);
  return {
    wood: o(P),
    roof: o(A),
    floor: o(i),
    leaves: [Q(1), Q(-1)],
  };
}
export async function createBarns(P: Object3D, A: AssetLoader) {
  let [i, I, E, e] = await Promise.all([
      A.texture("timber"),
      A.texture("timber-normal", false),
      A.texture("felt"),
      A.texture("felt-normal", false),
    ]),
    g = new MeshStandardMaterial({
      map: i,
      normalMap: I,
      normalScale: new Vector2(0.22, 0.22),
      color: 15782324,
      roughness: 0.97,
      vertexColors: true,
    });
  g.onBeforeCompile = (r) => {
    r.fragmentShader = r.fragmentShader.replace(
      "#include <map_fragment>",
      `#include <map_fragment>
 diffuseColor.rgb*=2.5;`,
    );
  };
  g.customProgramCacheKey = () => "barn-source-timber-diffuse-v1";
  let s = new MeshStandardMaterial({
      map: E,
      normalMap: e,
      normalScale: new Vector2(0.19, 0.19),
      color: 6583694,
      roughness: 1,
      vertexColors: true,
    }),
    o = new MeshStandardMaterial({
      color: 5725014,
      roughness: 1,
      vertexColors: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
    Q = buildBarnGeometry(),
    w: Record<Part, BufferGeometry[]> = {
      wood: [],
      roof: [],
      floor: [],
    },
    t: Mesh[] = [],
    D: Mesh[][] = [];
  for (let r of BARNS) {
    let v = new Group();
    v.name = `Sheep barn ${r.id}`;
    v.position.set(r.x, groundHeight(r.x, r.z), r.z);
    v.rotation.y = r.yaw;
    P.add(v);
    v.updateMatrixWorld(true);
    for (let n of ["wood", "roof", "floor"] as const)
      w[n].push(Q[n].clone().applyMatrix4(v.matrixWorld));
    let C = Q.leaves.map((n, a) => {
      let z = new Mesh(n, g);
      z.name = `${r.id} door ${a}`;
      z.position.set(
        ((a === 0 ? -1 : 1) * DOOR_WIDTH) / 2,
        0,
        BARN_DEPTH / 2 + 0.065,
      );
      z.castShadow = z.receiveShadow = true;
      z.userData.shadowBounds = n.boundingBox!.clone();
      v.add(z);
      t.push(z);
      return z;
    });
    D.push(C);
  }
  let B = 0;
  for (let [r, v] of [
    ["wood", g],
    ["roof", s],
    ["floor", o],
  ] as [Part, MeshStandardMaterial][]) {
    let C = w[r],
      n = mergeGeometries(C)!;
    C.forEach((z) => z.dispose());
    Q[r].dispose();
    let a = new Mesh(n, v);
    a.name = `Merged barn ${r}`;
    a.castShadow = a.receiveShadow = true;
    P.add(a);
    B += n.attributes.position.count / 3;
  }
  B += Q.leaves.reduce((r, v) => r + v.attributes.position.count / 3, 0) * 2;
  let M = barnDoors(4.4);
  return {
    doors: t,
    triangles: B,
    drawCalls: 7,
    doorState: () => M,
    update(r: number) {
      M = barnDoors(r);
      D.forEach((v, C) => {
        let n = M[BARNS[C].id] * Math.PI * 0.62;
        v[0].rotation.y = -n;
        v[1].rotation.y = n;
      });
    },
  };
}
