import type { PerspectiveCamera } from "three";
import {
  BufferGeometry,
  CanvasTexture,
  Color,
  Float32BufferAttribute,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Points,
  PointsMaterial,
  RepeatWrapping,
  SphereGeometry,
  Vector2,
  Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { AssetLoader } from "../assets/AssetLoader";
import type { Quality } from "../types";
import { BARNS, JUMP_YAW } from "./barnLayout";
import { createBarns } from "./barns";
import { harmonize } from "./materials";
import { contactExposure, createNaturalMotion } from "./sheep/natural";
import { SheepActor } from "./sheep/SheepActor";
import {
  APPROACH_PATH,
  ENTRANCE_PATH,
  RETURN_PATH,
  sheepAge,
  sheepPose,
} from "./sheep/timeline";
import { createSky } from "./sky";
import {
  TERRAIN_RADIUS,
  creekCenter,
  creekWidth,
  groundHeight,
  meadowHeight,
  smoothRange,
} from "./terrain";
import { applyGroundCover, createGrass } from "./vegetation/grass";
import { createVegetation } from "./vegetation/plants";
export function seededRandom(seed: number = 71) {
  return () => (
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0),
    seed / 4294967296
  );
}
export function createContactTexture() {
  let canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  let context = canvas.getContext("2d")!,
    gradient = context.createRadialGradient(32, 32, 2, 32, 32, 32);
  gradient.addColorStop(0, "rgba(5,20,24,.4)");
  gradient.addColorStop(0.45, "rgba(5,20,24,.16)");
  gradient.addColorStop(1, "rgba(5,20,24,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  return new CanvasTexture(canvas);
}
export function createTerrainGeometry() {
  let P = [0];
  for (let o = 0.5; o <= 65; o += 0.5) P.push(o);
  for (let o = 1; o <= 26; o++)
    P.push(65 + (TERRAIN_RADIUS - 65) * (o / 26) ** 1.5);
  let A = 256,
    i = [],
    I = [],
    E = [],
    e = [],
    g = new Color();
  for (let o = 0; o < P.length; o++)
    for (let Q = 0; Q <= A; Q++) {
      let w = (Q / A) * Math.PI * 2,
        t = Math.sin(w) * P[o],
        D = Math.cos(w) * P[o],
        B = groundHeight(t, D);
      i.push(t, B, D);
      I.push(t / 4, D / 4);
      let M =
          0.91 +
          0.055 * Math.sin(t * 0.16 + Math.cos(D * 0.1)) +
          0.035 * Math.sin(D * 0.3 + t * 0.21),
        r =
          1 -
          smoothRange(
            creekWidth(D) + 0.1,
            creekWidth(D) + 1.1,
            Math.abs(t - creekCenter(D)),
          );
      if (
        (g
          .setRGB(0.88 * M, 0.99 * M, 0.87 * M)
          .lerp(new Color(0.58, 0.56, 0.43), r * 0.3),
        E.push(g.r, g.g, g.b),
        o > 0 && Q > 0)
      ) {
        let v = o * (A + 1) + Q;
        e.push(v, v - A - 2, v - 1, v, v - A - 1, v - A - 2);
      }
    }
  let s = new BufferGeometry();
  s.setAttribute("position", new Float32BufferAttribute(i, 3));
  s.setAttribute("uv", new Float32BufferAttribute(I, 2));
  s.setAttribute("color", new Float32BufferAttribute(E, 3));
  s.setIndex(e);
  s.computeVertexNormals();
  s.computeBoundingSphere();
  return s;
}
export async function createWorld(scene: Object3D, assets: AssetLoader) {
  let [
      sheepSource,
      fenceSource,
      meadowTexture,
      meadowNormal,
      moonTexture,
      cloudTexture,
    ] = await Promise.all([
      assets.model("sheep-model"),
      assets.model("fence-model"),
      assets.texture("meadow"),
      assets.texture("meadow-normal", false),
      assets.texture("moon"),
      assets.texture("cloud"),
    ]),
    wind = {
      value: 0,
    },
    root = new Group();
  root.name = "Continuous felt meadow";
  scene.add(root);
  let random = seededRandom(2480770061),
    transform = new Object3D(),
    color = new Color(),
    actors = Array.from(
      {
        length: 3,
      },
      () => new SheepActor(sheepSource),
    );
  actors.forEach((Z) => root.add(Z.root));
  for (let Z of [meadowTexture, meadowNormal]) {
    Z.wrapS = Z.wrapT = RepeatWrapping;
    Z.repeat.set(1, 1);
    Z.anisotropy = 4;
  }
  let groundMaterial = new MeshStandardMaterial({
      map: meadowTexture,
      normalMap: meadowNormal,
      normalScale: new Vector2(0.65, 0.65),
      color: 10467243,
      vertexColors: true,
      roughness: 1,
    }),
    eye = {
      value: new Vector3(),
    };
  applyGroundCover(groundMaterial, eye);
  let terrain = new Mesh(createTerrainGeometry(), groundMaterial);
  terrain.name = "Seamless radial terrain";
  terrain.receiveShadow = true;
  root.add(terrain);
  let fence = fenceSource.scene.clone(true);
  fence.position.y = groundHeight(0, 0);
  fence.rotation.y = JUMP_YAW;
  fence.traverse((Z) => {
    Z instanceof Mesh && ((Z.castShadow = true), (Z.receiveShadow = true));
  });
  root.add(fence);
  let barns = await createBarns(root, assets),
    grass = createGrass(root, groundMaterial, wind, eye),
    plants = await createVegetation(root, assets, wind),
    treeLocations = plants.trees.map((Z) => [Z.x, Z.z, Z.scale]),
    bankPositions = [],
    bankColors = [],
    bankUvs = [],
    bankIndices = [];
  for (let Z of [-1, 1])
    for (let PA = 0; PA <= 420; PA++)
      for (let _ = 0; _ <= 4; _++) {
        let DA = PA - 210,
          wA = _ / 4,
          IA = creekCenter(DA) + Z * (creekWidth(DA) + wA * 1.15),
          G = groundHeight(IA, DA) + 0.012;
        bankPositions.push(IA, G, DA);
        bankUvs.push(IA / 4, DA / 4);
        let h =
          0.91 +
          0.055 * Math.sin(IA * 0.16 + Math.cos(DA * 0.1)) +
          0.035 * Math.sin(DA * 0.3 + IA * 0.21);
        if (
          (color
            .setRGB(0.88 * h, 0.99 * h, 0.87 * h)
            .lerp(
              new Color(0.58, 0.56, 0.43),
              (1 - smoothRange(0, 1, wA)) * 0.45,
            ),
          bankColors.push(color.r, color.g, color.b),
          PA > 0 && _ > 0)
        ) {
          let u = bankPositions.length / 3 - 1;
          Z < 0
            ? bankIndices.push(u, u - 1, u - 6, u, u - 6, u - 5)
            : bankIndices.push(u, u - 6, u - 1, u, u - 5, u - 6);
        }
      }
  let bankGeometry = new BufferGeometry();
  bankGeometry.setAttribute(
    "position",
    new Float32BufferAttribute(bankPositions, 3),
  );
  bankGeometry.setAttribute("color", new Float32BufferAttribute(bankColors, 3));
  bankGeometry.setAttribute("uv", new Float32BufferAttribute(bankUvs, 2));
  bankGeometry.setIndex(bankIndices);
  bankGeometry.computeVertexNormals();
  let bankMaterial = groundMaterial.clone();
  applyGroundCover(bankMaterial, eye);
  let bank = new Mesh(bankGeometry, bankMaterial);
  bank.receiveShadow = true;
  root.add(bank);
  let waterGeometry = new PlaneGeometry(2, 420, 14, 560);
  waterGeometry.rotateX(-Math.PI / 2);
  let waterPositions = waterGeometry.attributes.position;
  for (let Z = 0; Z < waterPositions.count; Z++) {
    let PA = waterPositions.getZ(Z),
      _ = creekCenter(PA) + waterPositions.getX(Z) * creekWidth(PA);
    waterPositions.setXYZ(Z, _, meadowHeight(_, PA) - 0.365, PA);
  }
  waterGeometry.computeVertexNormals();
  let waterTime = {
      value: 0,
    },
    waterMaterial = new MeshStandardMaterial({
      color: 1653586,
      metalness: 0.02,
      roughness: 0.88,
    });
  waterMaterial.onBeforeCompile = (Z) => {
    Z.uniforms.uWater = waterTime;
    Z.vertexShader =
      `varying vec3 waterPosition;
` + Z.vertexShader;
    Z.vertexShader = Z.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
 waterPosition=position;`,
    );
    Z.fragmentShader =
      `uniform float uWater;varying vec3 waterPosition;
` + Z.fragmentShader;
    Z.fragmentShader = Z.fragmentShader.replace(
      "#include <color_fragment>",
      `#include <color_fragment>
 vec2 q=waterPosition.xz; float a=sin(dot(q,vec2(3.1,4.7))+uWater*.45+sin(q.y*.87)); float b=sin(q.x*5.3-q.y*3.9-uWater*.31); float ripple=sin(q.y*7.4+sin(q.x*4.2+q.y*1.1)*1.5-uWater*.65); float breaks=smoothstep(.18,.88,.5+.5*sin(q.x*11.3+sin(q.y*2.7)*2.+uWater*.11)); float gleam=pow(max(0.,ripple),14.)*breaks; float shimmer=.5+.5*sin(q.x*1.7+q.y*.7+uWater*.18); diffuseColor.rgb*=.92+.08*a*b; diffuseColor.rgb+=vec3(.028,.031,.03)*gleam*shimmer; float reflection=exp(-pow((q.x-16.4+.18*sin(q.y*.8))/.5,2.))*exp(-pow((q.y+6.)/13.,2.)); diffuseColor.rgb+=vec3(.12,.085,.036)*gleam*reflection;`,
    );
  };
  let water = new Mesh(waterGeometry, waterMaterial);
  water.name = "Curved creek inside banks";
  water.receiveShadow = true;
  root.add(water);
  let rockGeometry = new SphereGeometry(1, 18, 12),
    rockMaterial = new MeshStandardMaterial({
      color: 6450299,
      roughness: 0.96,
    }),
    rocks = new InstancedMesh(rockGeometry, rockMaterial, 84);
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  for (let Z = 0; Z < 84; Z++) {
    let PA = random() * 135 - 70,
      _ = Z % 2 ? 1 : -1,
      DA = creekCenter(PA) + _ * (creekWidth(PA) + 0.18 + random() * 0.65),
      wA = 0.25 + random() * 0.48,
      IA = 0.21 + random() * 0.3;
    transform.position.set(DA, groundHeight(DA, PA) + IA * 0.27, PA);
    transform.scale.set(wA, IA, 0.28 + random() * 0.48);
    transform.rotation.set(
      (random() - 0.5) * 0.22,
      random() * 6,
      (random() - 0.5) * 0.2,
    );
    transform.updateMatrix();
    rocks.setMatrixAt(Z, transform.matrix);
  }
  rocks.computeBoundingSphere();
  root.add(rocks);
  let contactTexture = createContactTexture(),
    contactMaterial = new MeshBasicMaterial({
      map: contactTexture,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      opacity: 0.65,
    }),
    contactGeometry = new PlaneGeometry(1, 1);
  contactGeometry.rotateX(-Math.PI / 2);
  let contactPieces = [];
  for (let [Z, PA, _] of treeLocations) {
    let DA = new PlaneGeometry(_ * 4.7, _ * 3.9, 6, 6);
    DA.rotateX(-Math.PI / 2);
    DA.translate(Z, 0, PA);
    let wA = DA.attributes.position;
    for (let IA = 0; IA < wA.count; IA++)
      wA.setY(IA, groundHeight(wA.getX(IA), wA.getZ(IA)) + 0.026);
    contactPieces.push(DA);
  }
  for (let Z of [-2.8, 0, 2.8]) {
    let PA = Math.cos(JUMP_YAW) * Z,
      _ = -Math.sin(JUMP_YAW) * Z,
      DA = new PlaneGeometry(0.75, 0.7, 2, 2);
    DA.rotateX(-Math.PI / 2);
    DA.translate(PA, 0, _);
    let wA = DA.attributes.position;
    for (let IA = 0; IA < wA.count; IA++)
      wA.setY(IA, groundHeight(wA.getX(IA), wA.getZ(IA)) + 0.025);
    contactPieces.push(DA);
  }
  let mergedContact = mergeGeometries(contactPieces);
  contactPieces.forEach((Z) => Z.dispose());
  root.add(new Mesh(mergedContact, contactMaterial));
  let sheepContactMaterial = contactMaterial.clone(),
    sheepContactOpacities = new InstancedBufferAttribute(
      new Float32Array(3).fill(0.4),
      1,
    ),
    sheepContactGeometry = contactGeometry.clone();
  sheepContactGeometry.setAttribute("contactOpacity", sheepContactOpacities);
  sheepContactMaterial.onBeforeCompile = (Z) => {
    Z.vertexShader =
      `attribute float contactOpacity;varying float vContactOpacity;
` + Z.vertexShader;
    Z.vertexShader = Z.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
 vContactOpacity=contactOpacity;`,
    );
    Z.fragmentShader =
      `varying float vContactOpacity;
` + Z.fragmentShader;
    Z.fragmentShader = Z.fragmentShader.replace(
      "#include <alphamap_fragment>",
      `#include <alphamap_fragment>
 diffuseColor.a*=vContactOpacity;`,
    );
  };
  let sheepContacts = new InstancedMesh(
    sheepContactGeometry,
    sheepContactMaterial,
    3,
  );
  sheepContacts.frustumCulled = false;
  root.add(sheepContacts);
  let sky = createSky(moonTexture, cloudTexture, random);
  root.add(sky.root);
  let qA = new BufferGeometry(),
    kA = [];
  for (let Z = 0; Z < 35; Z++) {
    let PA = (random() - 0.5) * 45,
      _ = random() * 45 - 25;
    kA.push(PA, groundHeight(PA, _) + 0.3 + random() * 1.4, _);
  }
  qA.setAttribute("position", new Float32BufferAttribute(kA, 3));
  let nA = new PointsMaterial({
    color: 16766362,
    size: 0.045,
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
  });
  root.add(new Points(qA, nA));
  let environmentTime = 0,
    previousPhase = 4.4,
    viewportHeight = innerHeight;
  harmonize(root);
  const motion = createNaturalMotion(actors, {
    groundHeight,
    meadowHeight,
    getPose: sheepPose,
    getAge: sheepAge,
    barns: BARNS,
    walkDistance: (age) =>
      age < 6.4
        ? APPROACH_PATH.sample(age).distance
        : age < 13.7
          ? RETURN_PATH.sample(age).distance
          : RETURN_PATH.length + ENTRANCE_PATH.sample(age).distance,
  });
  const world = {
    root: root,
    actors: actors,
    barnTriangles: barns.triangles,
    barnDrawCalls: barns.drawCalls,
    doorState: barns.doorState,
    dynamicShadowRoots: [...actors.map((Z) => Z.root), ...barns.doors],
    grassInstances: grass.instances,
    flowerInstances: plants.flowerCount,
    environmentPhase: () => environmentTime,
    resize(Z: number, PA: number = innerHeight) {
      viewportHeight = PA;
    },
    update(
      Z: number,
      PA: boolean,
      _: PerspectiveCamera,
      activeSeconds?: number,
    ) {
      PA || (environmentTime += Math.max(0, Z - previousPhase));
      previousPhase = Z;
      eye.value.copy(_.position);
      grass.update(_, viewportHeight);
      plants.update(_, viewportHeight);
      wind.value = environmentTime;
      waterTime.value = environmentTime;
      sky.update(_, environmentTime);
      barns.update(Z);
      nA.opacity = 0.62 + Math.sin(environmentTime * 0.32) * 0.1;
      actors.forEach((DA, wA) => {
        let IA = DA.root.position,
          G = Math.max(0, IA.y - groundHeight(IA.x, IA.z));
        transform.position.set(IA.x, groundHeight(IA.x, IA.z) + 0.025, IA.z);
        transform.rotation.set(0, DA.root.rotation.y, 0);
        transform.scale.set(1.55 + G * 0.2, 1, 1.25 + G * 0.2);
        transform.updateMatrix();
        sheepContacts.setMatrixAt(wA, transform.matrix);
        sheepContactOpacities.setX(
          wA,
          DA.root.visible
            ? 0.8 * contactExposure(IA.x, IA.z, BARNS) * Math.exp(-G * 0.8)
            : 0,
        );
      });
      sheepContacts.instanceMatrix.needsUpdate = true;
      sheepContactOpacities.needsUpdate = true;
      motion.update(Z, activeSeconds, PA);
    },
    quality(Z: Quality) {
      grass.quality(Z);
    },
    disposeActors() {
      actors.forEach((Z) => Z.dispose());
    },
  };
  motion.publish(world);
  return world;
}
