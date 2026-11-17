import type { PerspectiveCamera, Texture } from "three";
import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  CanvasTexture,
  Color,
  Float32BufferAttribute,
  Group,
  Mesh,
  Points,
  PointsMaterial,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Vector3,
} from "three";
export function createMoonGlow() {
  let P = document.createElement("canvas");
  P.width = P.height = 128;
  let A = P.getContext("2d")!,
    i = A.createRadialGradient(64, 64, 0, 64, 64, 64);
  i.addColorStop(0, "rgba(255,227,182,.3)");
  i.addColorStop(0.28, "rgba(255,224,177,.09)");
  i.addColorStop(1, "rgba(255,224,177,0)");
  A.fillStyle = i;
  A.fillRect(0, 0, 128, 128);
  let I = new CanvasTexture(P);
  I.colorSpace = SRGBColorSpace;
  return I;
}
export function createSky(P: Texture, A: Texture, i: () => number) {
  let I = new Group();
  I.name = "Distant sky";
  let E = new Mesh(
    new SphereGeometry(270, 40, 24),
    new ShaderMaterial({
      side: BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
      toneMapped: false,
      uniforms: {
        horizon: {
          value: new Color("#263e4b"),
        },
        zenith: {
          value: new Color("#0c1831"),
        },
      },
      vertexShader:
        "varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader:
        `varying vec3 direction;uniform vec3 horizon;uniform vec3 zenith;void main(){float h=normalize(direction).y;vec3 c=mix(horizon,zenith,smoothstep(-.03,.35,h));gl_FragColor=vec4(c,1.);#include <colorspace_fragment>
}`.replace(
          ";#include",
          `;
#include`,
        ),
    }),
  );
  E.renderOrder = -1e3;
  E.frustumCulled = false;
  I.add(E);
  let e = new Sprite(
    new SpriteMaterial({
      map: P,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    }),
  );
  e.position.copy(MOON_DIRECTION).multiplyScalar(195);
  e.scale.set(18, 18, 1);
  e.renderOrder = -900;
  I.add(e);
  let g = new Sprite(
    new SpriteMaterial({
      map: createMoonGlow(),
      depthWrite: false,
      fog: false,
      toneMapped: false,
      blending: AdditiveBlending,
      opacity: 0.5,
    }),
  );
  g.position.copy(MOON_DIRECTION).multiplyScalar(196);
  g.scale.set(30, 30, 1);
  g.renderOrder = -901;
  I.add(g);
  let s = Array.from(
      {
        length: 8,
      },
      (D, B) => {
        let M = (B * Math.PI) / 4 + 0.2,
          r = new Sprite(
            new SpriteMaterial({
              map: A,
              color: 7439779,
              transparent: true,
              opacity: 0.22,
              depthWrite: false,
              fog: false,
            }),
          );
        r.position.set(Math.sin(M) * 195, 32 + (B % 3) * 13, Math.cos(M) * 195);
        r.scale.set(42 + (B % 2) * 14, 29 + (B % 2) * 8, 1);
        r.renderOrder = -950;
        I.add(r);
        return {
          sprite: r,
          x: r.position.x,
          z: r.position.z,
          phase: B * 1.7,
        };
      },
    ),
    o = [];
  for (let D = 0; D < 230; D++) {
    let B = i() * Math.PI * 2,
      M = 0.045 + i() * 0.93,
      r = Math.sqrt(1 - M * M);
    o.push(Math.sin(B) * r * 235, M * 235, Math.cos(B) * r * 235);
  }
  let Q = new BufferGeometry();
  Q.setAttribute("position", new Float32BufferAttribute(o, 3));
  let w = new PointsMaterial({
      color: 15984334,
      size: 0.12,
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    }),
    t = new Points(Q, w);
  t.renderOrder = -960;
  I.add(t);
  return {
    root: I,
    update(D: PerspectiveCamera, B: number) {
      I.position.copy(D.position);
      s.forEach((M) => {
        M.sprite.position.x = M.x + Math.sin(B * 0.009 + M.phase) * 2.5;
        M.sprite.position.z = M.z + Math.cos(B * 0.008 + M.phase) * 1.3;
      });
      w.opacity = 0.5 + Math.sin(B * 0.2) * 0.035;
    },
  };
}
export const MOON_DIRECTION = new Vector3(-0.08, 0.11, -1).normalize();
