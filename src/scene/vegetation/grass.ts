type GrassCell =
  ReturnType<typeof grassCells> extends Generator<infer C> ? C : never;
type TileCell = {
  cell: GrassCell;
  originalIndex: number;
  originalKey: number;
};
import type { MeshStandardMaterial, PerspectiveCamera } from "three";
import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedMesh,
  MathUtils,
  MeshLambertMaterial,
  Object3D,
  Quaternion,
  Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { Quality } from "../../types";
import { BARNS, barnDistance } from "../barnLayout";
import { groundHeight } from "../terrain";
import { ScreenDetail } from "./detail";
import { GRASS_BANDS, cellRandom, grassCells } from "./layout";
export function coverNoise(P: number, A: number) {
  let i = (Q: number, w: number) => {
      let t = fract(Q * 0.1031),
        D = fract(w * 0.1031),
        B = t,
        M = t * (D + 33.33) + D * (B + 33.33) + B * (t + 33.33);
      t += M;
      D += M;
      B += M;
      return fract((t + D) * B);
    },
    I = Math.floor(P),
    E = Math.floor(A),
    e = fract(P),
    g = fract(A),
    s = e * e * (3 - 2 * e),
    o = g * g * (3 - 2 * g);
  return MathUtils.lerp(
    MathUtils.lerp(i(I, E), i(I + 1, E), s),
    MathUtils.lerp(i(I, E + 1), i(I + 1, E + 1), s),
    o,
  );
}
export function coverTone(P: number, A: number) {
  let i = coverNoise(P * 0.68, A * 0.68);
  return (
    0.94 +
    0.1 * coverNoise(P * 7.4 + i * 2.1, A * 7.4 + i * 0.9) +
    0.02 * coverNoise(P * 47, A * 47)
  );
}
export function applyGroundCover(
  material: MeshStandardMaterial,
  eye: {
    value: Vector3;
  },
) {
  material.onBeforeCompile = (i) => {
    i.uniforms.uCoverEye = eye;
    i.vertexShader =
      `varying vec3 vCoverWorld;
` + i.vertexShader;
    i.vertexShader = i.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
 vCoverWorld=(modelMatrix*vec4(position,1.)).xyz;`,
    );
    i.fragmentShader =
      `uniform vec3 uCoverEye;varying vec3 vCoverWorld;
` +
      COVER_NOISE_GLSL +
      i.fragmentShader;
    i.fragmentShader = i.fragmentShader.replace(
      "#include <color_fragment>",
      `#include <color_fragment>
` + COVER_COLOR_GLSL,
    );
    i.fragmentShader = i.fragmentShader.replace(
      "#include <normal_fragment_maps>",
      `#include <normal_fragment_maps>
   float napHeight=(nap*.0045+fine*.0012)*coverDetail;
   vec3 pX=dFdx(-vViewPosition),pY=dFdy(-vViewPosition);
   vec3 rX=cross(pY,normal),rY=cross(normal,pX);
   float determinant=dot(pX,rX);
   vec3 slope=sign(determinant)*(dFdx(napHeight)*rX+dFdy(napHeight)*rY);
   normal=normalize(max(abs(determinant),.0000001)*normal-slope);
  `,
    );
  };
  material.customProgramCacheKey = () => "felt-ground-understory-v2";
}
export function createGrassGeometry(bladeCount: number, segments: number) {
  let i = [];
  for (let E = 0; E < bladeCount; E++) {
    let e = E * 2.399,
      g = E < 2,
      s = (g ? 0.09 : 0.17) + (E % 4) * 0.033,
      o = g ? 0.085 : 0.055 + (E % 3) * 0.009,
      Q = [],
      w = [],
      t = [],
      D = [];
    for (let M = 0; M <= segments; M++) {
      let r = M / segments,
        v =
          o *
          (M === segments
            ? 0.02
            : 0.48 * Math.sin(Math.PI * (0.16 + r * 0.78))),
        C = (g ? 0.13 : 0.085 + E * 0.01) * r * r,
        n = s * (r - 0.1 * r * r * r);
      if (
        (Q.push(C - v, n, r * r * 0.04, C + v, n, r * r * 0.04),
        w.push(0, r, 1, r),
        t.push(r - 0.1 * r * r * r, r - 0.1 * r * r * r),
        M)
      ) {
        let a = M * 2;
        D.push(a - 2, a - 1, a, a - 1, a + 1, a);
      }
    }
    let B = new BufferGeometry();
    B.setAttribute("position", new Float32BufferAttribute(Q, 3));
    B.setAttribute("uv", new Float32BufferAttribute(w, 2));
    B.setAttribute("coverGrowth", new Float32BufferAttribute(t, 1));
    B.setIndex(D);
    B.computeVertexNormals();
    B.rotateY(e);
    B.translate(
      Math.sin(e) * (0.06 + (E % 4) * 0.025),
      0,
      Math.cos(e) * (0.06 + (E % 4) * 0.025),
    );
    i.push(B);
  }
  let I = mergeGeometries(i);
  i.forEach((E) => E.dispose());
  return I;
}
export function createGrass(
  root: Object3D,
  ground: MeshStandardMaterial,
  wind: {
    value: number;
  },
  eye: {
    value: Vector3;
  },
) {
  let material = new MeshLambertMaterial({
    map: ground.map,
    color: ground.color,
    side: DoubleSide,
  });
  material.onBeforeCompile = (B) => {
    B.uniforms.uWind = wind;
    B.uniforms.uCoverEye = eye;
    B.vertexShader =
      `attribute float coverGrowth;attribute float coverVariant;attribute float coverTone;varying float vCoverTone;uniform float uWind;uniform vec3 uCoverEye;varying vec3 vCoverWorld;varying vec3 vCoverUp;varying float vBlade;
` + B.vertexShader;
    B.vertexShader = B.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
   vec3 anchor=(modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xyz;
   vCoverTone=coverTone;
   transformed.y+=coverVariant*.013*coverGrowth;
   float shapeAngle=coverVariant*.57;transformed.xz=mat2(cos(shapeAngle),-sin(shapeAngle),sin(shapeAngle),cos(shapeAngle))*transformed.xz;
   vBlade=clamp(transformed.y/.30,0.,1.);
   float fade=1.-smoothstep(78.,125.,length(anchor.xz-uCoverEye.xz));
   transformed.y=transformed.y*fade-.045*(1.-fade);
   float gust=sin(uWind*.48+anchor.x*.14+anchor.z*.1)+.35*sin(uWind*.23-anchor.x*.07+anchor.z*.21);
   transformed.x+=gust*.019*vBlade*vBlade*fade;
   transformed.z+=gust*.01*vBlade*vBlade*fade;
   vCoverWorld=(modelMatrix*instanceMatrix*vec4(transformed,1.)).xyz;
   vCoverUp=normalize(normalMatrix*mat3(instanceMatrix)*vec3(0.,1.,0.));
   vMapUv=vCoverWorld.xz/4.;
  `,
    );
    B.vertexShader = B.vertexShader.replace(
      "#include <beginnormal_vertex>",
      `#include <beginnormal_vertex>
 float normalAngle=coverVariant*.57;objectNormal.xz=mat2(cos(normalAngle),-sin(normalAngle),sin(normalAngle),cos(normalAngle))*objectNormal.xz;`,
    );
    B.fragmentShader =
      `uniform vec3 uCoverEye;varying float vCoverTone;varying vec3 vCoverWorld;varying vec3 vCoverUp;varying float vBlade;
` + B.fragmentShader;
    B.fragmentShader = B.fragmentShader.replace(
      "#include <color_fragment>",
      `#include <color_fragment>
   float coverDetail=1.-smoothstep(22.,68.,length(vCoverWorld.xz-uCoverEye.xz));
   diffuseColor.rgb*=mix(1.,vCoverTone,coverDetail)*mix(.82,1.13,vBlade);`,
    );
    B.fragmentShader = B.fragmentShader.replace(
      "#include <normal_fragment_maps>",
      `#include <normal_fragment_maps>
 normal=normalize(mix(normal,normalize(vCoverUp),.7));`,
    );
  };
  let transform = new Object3D(),
    color = new Color(),
    up = new Vector3(0, 1, 0),
    normal = new Vector3(),
    slope = new Quaternion(),
    twist = new Quaternion(),
    details = [],
    visibleTiles = [];
  for (let B = 0; B < GRASS_BANDS.length; B++) {
    let M = GRASS_BANDS[B],
      r: GrassCell[][] = Array.from(
        {
          length: 24,
        },
        () => [],
      );
    for (let a of grassCells(B)) r[a.sector * 3 + a.variant].push(a);
    let v = new Map<string, TileCell[]>();
    r.forEach((a, z) =>
      a.forEach((T, l) => {
        let k = `${Math.floor(T.x / 12)},${Math.floor(T.z / 12)}`;
        v.has(k) || v.set(k, []);
        v.get(k)!.push({
          cell: T,
          originalIndex: l,
          originalKey: z,
        });
      }),
    );
    let C = [M.segments, Math.max(1, M.segments - 1), 1],
      n = C.map((a) => createGrassGeometry(M.blades, a));
    for (let a of v.values()) {
      let z = a.length,
        T = new InstancedBufferAttribute(new Float32Array(z * 16), 16),
        l = new InstancedBufferAttribute(new Float32Array(z * 3), 3),
        k = new InstancedBufferAttribute(new Float32Array(z), 1),
        Y = new InstancedBufferAttribute(new Float32Array(z), 1),
        j = new Vector3(),
        c = 0;
      a.forEach(({ cell: x, originalIndex: L, originalKey: p }, d) => {
        let { x: K, z: $, height: f, variant: gA } = x,
          iA = cellRandom(Math.round(K * 100), Math.round($ * 100), B + 701),
          rA = Math.min(...BARNS.map((H) => barnDistance(H, K, $))),
          LA = MathUtils.smoothstep(rA, 0.03, 0.38),
          NA = 0.02 + 0.98 * LA;
        Y.setX(d, coverTone(K, $));
        normal
          .set(
            (groundHeight(K - 0.2, $) - groundHeight(K + 0.2, $)) / 0.4,
            1,
            (groundHeight(K, $ - 0.2) - groundHeight(K, $ + 0.2)) / 0.4,
          )
          .normalize();
        slope.setFromUnitVectors(up, normal);
        twist.setFromAxisAngle(up, iA * Math.PI * 2);
        transform.position.set(K, groundHeight(K, $) - 0.018, $);
        transform.quaternion.copy(slope).multiply(twist);
        transform.scale.set(
          0.9 + iA * 0.25,
          Math.max(0.015, f) * (0.8 + iA * 0.4) * NA,
          0.9 + cellRandom(L, p, B + 733) * 0.25,
        );
        transform.updateMatrix();
        transform.matrix.toArray(T.array, d * 16);
        k.setX(d, gA);
        let VA =
            0.91 +
            0.055 * Math.sin(K * 0.16 + Math.cos($ * 0.1)) +
            0.035 * Math.sin($ * 0.3 + K * 0.21),
          EP = 0.94 + iA * 0.11;
        color.setRGB(0.88 * VA * EP, 0.99 * VA * EP, 0.87 * VA * EP);
        color.toArray(l.array, d * 3);
        j.add(transform.position);
        c = Math.max(c, transform.scale.y * 0.32);
      });
      j.divideScalar(z);
      let U = n.map((x, L) => {
        let p = new BufferGeometry();
        for (let K of Object.keys(x.attributes))
          p.setAttribute(K, x.getAttribute(K));
        p.setIndex(x.index);
        p.setAttribute("coverVariant", k);
        p.setAttribute("coverTone", Y);
        let d = new InstancedMesh(p, material, z);
        d.instanceMatrix = T;
        d.instanceColor = l;
        d.name = `Continuous grass tile ${B}/${L}`;
        d.receiveShadow = true;
        d.computeBoundingSphere();
        root.add(d);
        return d;
      });
      details.push(new ScreenDetail(U, j, c, [13, 5.5]));
      visibleTiles.push(U[0]);
    }
  }
  return {
    get instances() {
      return visibleTiles.reduce((B, M) => B + M.count, 0);
    },
    update(B: PerspectiveCamera, M: number) {
      details.forEach((r) => r.update(B, M));
    },
    quality(B: Quality) {},
  };
}
export const COVER_NOISE_GLSL = `
float coverHash(vec2 p) { vec3 q=fract(vec3(p.xyx)*.1031); q+=dot(q,q.yzx+33.33); return fract((q.x+q.y)*q.z); }
float coverNoise(vec2 p) {
 vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
 return mix(mix(coverHash(i),coverHash(i+vec2(1.,0.)),f.x),mix(coverHash(i+vec2(0.,1.)),coverHash(i+1.),f.x),f.y);
}
float coverNap(vec2 p) {
 float broad=coverNoise(p*.68);
 return coverNoise(p*7.4+vec2(broad*2.1,broad*.9));
}
`;
export const COVER_COLOR_GLSL = `
float coverDistance=length(vCoverWorld.xz-uCoverEye.xz);
float coverDetail=1.-smoothstep(22.,68.,coverDistance);
float nap=coverNap(vCoverWorld.xz);
float fine=coverNoise(vCoverWorld.xz*47.);
diffuseColor.rgb*=mix(1.,.94+.10*nap+.02*fine,coverDetail);
`;
export const fract = (P: number) => P - Math.floor(P);
