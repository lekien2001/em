import type {
  DirectionalLight,
  Object3D,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from "three";
import {
  Box3,
  Mesh,
  MeshLambertMaterial,
  MeshStandardMaterial,
  ShaderChunk,
  Vector2,
  Vector3,
  Vector4,
} from "three";
import { release } from "../assets/dispose";
export function cacheStaticShadows(
  P: WebGLRenderer,
  A: Scene,
  i: DirectionalLight,
  I: PerspectiveCamera,
  E: Object3D[],
) {
  let e = new Set();
  E.forEach((r) => r.traverse((v) => e.add(v)));
  let g = E.map((r) => r.visible);
  E.forEach((r) => (r.visible = false));
  let s: Mesh[] = [];
  A.traverse((r) => {
    r instanceof Mesh && r.castShadow && !e.has(r) && s.push(r);
  });
  P.shadowMap.autoUpdate = true;
  P.shadowMap.needsUpdate = true;
  P.info.reset();
  P.render(A, I);
  E.forEach((r, v) => (r.visible = g[v]));
  let o = i.shadow.map;
  if (!o) throw new Error("Static shadow depth map unavailable");
  let Q = i.shadow.matrix.clone(),
    w = new Vector2(o.width, o.height),
    t = new Vector4(2, 2, -1, -1);
  i.shadow.map = null;
  s.forEach((r) => (r.castShadow = false));
  P.shadowMap.autoUpdate = false;
  let D = new Set<MeshStandardMaterial | MeshLambertMaterial>();
  A.traverse((r) => {
    if (r instanceof Mesh && r.receiveShadow)
      for (let v of Array.isArray(r.material) ? r.material : [r.material])
        (v instanceof MeshStandardMaterial ||
          v instanceof MeshLambertMaterial) &&
          D.add(v);
  });
  for (let r of D) {
    let v = r.onBeforeCompile.bind(r),
      C = r.customProgramCacheKey();
    r.onBeforeCompile = (n, a) => {
      v(n, a);
      n.uniforms.uStaticDepth = {
        value: o.texture,
      };
      n.uniforms.uStaticSize = {
        value: w,
      };
      n.uniforms.uActorShadowRect = {
        value: t,
      };
      n.fragmentShader =
        `uniform sampler2D uStaticDepth;uniform vec2 uStaticSize;uniform vec4 uActorShadowRect;
` + n.fragmentShader;
      let z = ShaderChunk.lights_fragment_begin.replace(
        /getShadow\( directionalShadowMap\[ i \], [^\n]*?\)/,
        (T) => {
          let l =
            "(vDirectionalShadowCoord[ i ].xy / vDirectionalShadowCoord[ i ].w)";
          return `min( ${`(all(greaterThanEqual(${l},uActorShadowRect.xy))&&all(lessThanEqual(${l},uActorShadowRect.zw)))`} ? ${T} : 1.0, getShadow( uStaticDepth, uStaticSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) )`;
        },
      );
      n.fragmentShader = n.fragmentShader.replace(
        "#include <lights_fragment_begin>",
        z,
      );
    };
    r.customProgramCacheKey = () => C + "|cached-static-shadows-v1";
    r.needsUpdate = true;
  }
  let B = new Vector3(),
    M = new Box3(new Vector3(-1.6, -0.12, -1.6), new Vector3(1.6, 2.4, 1.6));
  return {
    bakes: 1,
    updateActorBounds() {
      t.set(2, 2, -1, -1);
      for (let r of E) {
        if (!r.visible) continue;
        r.updateWorldMatrix(true, false);
        let v = r.userData.shadowBounds || M;
        for (let C of [v.min.x, v.max.x])
          for (let n of [v.min.z, v.max.z])
            for (let a of [v.min.y, v.max.y]) {
              B.set(C, a, n).applyMatrix4(r.matrixWorld).applyMatrix4(Q);
              t.x = Math.min(t.x, B.x - 0.008);
              t.y = Math.min(t.y, B.y - 0.008);
              t.z = Math.max(t.z, B.x + 0.008);
              t.w = Math.max(t.w, B.y + 0.008);
            }
      }
    },
    dispose() {
      release(o);
    },
  };
}
