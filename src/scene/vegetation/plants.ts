import type { PerspectiveCamera } from "three";
import {
  Box3,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
  Object3D,
  Vector3,
} from "three";
import type { AssetId, AssetLoader } from "../../assets/AssetLoader";
import { clearBarnPlant } from "../barnLayout";
import { groundHeight } from "../terrain";
import { ScreenDetail } from "./detail";
import type { Placement } from "./layout";
import { TREE_CENTERS, TREE_PLACEMENTS, flowerPlacements } from "./layout";
export async function createVegetation(
  root: Object3D,
  assets: AssetLoader,
  wind: {
    value: number;
  },
) {
  let assetIds: AssetId[] = [
      "tree-broad-model",
      "tree-lean-model",
      "tree-compact-model",
      "tree-broad-low-model",
      "tree-lean-low-model",
      "tree-compact-low-model",
      "lavender-tall-merged-hi-model",
      "lavender-wide-merged-hi-model",
      "lavender-low-merged-hi-model",
      "lavender-tall-merged-mid-model",
      "lavender-wide-merged-mid-model",
      "lavender-low-merged-mid-model",
      "lavender-tall-merged-far-model",
      "lavender-wide-merged-far-model",
      "lavender-low-merged-far-model",
    ],
    [models, felt, leavesNormal, timber, timberNormal, atlas, atlasNormal] =
      await Promise.all([
        Promise.all(assetIds.map((Y) => assets.model(Y))),
        assets.texture("canopy-felt"),
        assets.texture("leaves-normal", false),
        assets.texture("timber"),
        assets.texture("timber-normal", false),
        assets.texture("lavender-atlas"),
        assets.texture("lavender-atlas-normal", false),
      ]),
    details = [],
    materials = new Map<string, MeshPhysicalMaterial>(),
    transform = new Object3D(),
    color = new Color(),
    meshCount = 0,
    flowerMeshes = [];
  function instantiate(
    Y: Object3D,
    j: Placement[],
    c: Object3D,
    U = 0,
    x = 0,
    L = false,
  ) {
    Y.updateMatrixWorld(true);
    Y.traverse((p) => {
      if (!(p instanceof Mesh)) return;
      let d = p.material as MeshPhysicalMaterial,
        K = d.name.toLowerCase(),
        $ = L ? "flower" : K.includes("canopy") ? "canopy" : "bark",
        f = materials.get($);
      f ||
        ((f = d.clone()),
        f.emissive.set(0),
        (f.roughness = 0.97),
        L &&
          ((f.map = atlas),
          (f.normalMap = atlasNormal),
          f.normalScale.set(0.15, 0.15),
          f.color.set(16777215)),
        K.includes("canopy") &&
          ((f.map = felt),
          (f.normalMap = leavesNormal),
          f.normalScale.set(0.38, 0.38),
          f instanceof MeshPhysicalMaterial &&
            ((f.sheen = 0.35),
            (f.sheenRoughness = 0.9),
            f.sheenColor.set(8824985))),
        K.includes("bark") &&
          ((f.map = timber),
          (f.normalMap = timberNormal),
          f.color.set(13022370),
          f instanceof MeshPhysicalMaterial && (f.sheen = 0)),
        (L || K.includes("canopy")) &&
          (f.onBeforeCompile = (rA) => {
            rA.uniforms.uPlantWind = wind;
            rA.vertexShader =
              `uniform float uPlantWind;
` + rA.vertexShader;
            rA.vertexShader = rA.vertexShader.replace(
              "#include <begin_vertex>",
              `#include <begin_vertex>
      vec3 anchor=(modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xyz;
      float h=max(0.,(instanceMatrix*vec4(position,1.)).y-instanceMatrix[3].y);
      float breeze=sin(uPlantWind*.36+anchor.x*.13+anchor.z*.09);
      transformed.x+=breeze*${L ? ".024*h*h" : ".006*h"};
      transformed.z+=sin(uPlantWind*.29+anchor.z*.17)*${L ? ".01*h*h" : ".003*h"};
     `,
            );
          }),
        materials.set($, f));
      let gA = new InstancedMesh(p.geometry, f, j.length);
      gA.name = L ? "Lavender 3D" : "Felt grove";
      gA.castShadow = true;
      gA.receiveShadow = true;
      j.forEach((iA, rA) => {
        transform.position.set(
          iA.x - U,
          groundHeight(iA.x, iA.z) - 0.05 * iA.scale,
          iA.z - x,
        );
        transform.rotation.set(0, iA.yaw, 0);
        transform.scale.setScalar(iA.scale);
        transform.updateMatrix();
        gA.setMatrixAt(
          rA,
          new Matrix4().multiplyMatrices(transform.matrix, p.matrixWorld),
        );
        let LA = 0.95 + 0.06 * Math.sin(iA.x * 0.71 + iA.z * 0.43);
        color.setRGB(LA, LA, LA);
        gA.setColorAt(rA, color);
      });
      gA.computeBoundingSphere();
      c.add(gA);
      meshCount++;
      L && flowerMeshes.push(gA);
    });
  }
  let treeKinds = ["broad", "lean", "compact"],
    treeHeights = models
      .slice(0, 3)
      .map((Y) => new Box3().setFromObject(Y.scene).getSize(new Vector3()).y);
  TREE_CENTERS.forEach(([Y, j], c) => {
    let U = new Group();
    U.name = "Layered felt grove";
    U.position.set(Y, 0, j);
    let x = new Group(),
      L = new Group();
    U.add(x, L);
    let p = TREE_PLACEMENTS.slice(c * 3, c * 3 + 3),
      d = 0;
    treeKinds.forEach((K, $) => {
      let f = p.filter((gA) => gA.kind === K);
      f.length &&
        (instantiate(models[$].scene, f, x, Y, j),
        instantiate(models[$ + 3].scene, f, L, Y, j),
        (d = Math.max(d, ...f.map((gA) => treeHeights[$] * gA.scale))));
    });
    details.push(
      new ScreenDetail(
        [x, L],
        new Vector3(Y, groundHeight(Y, j) + d * 0.5, j),
        d,
        [160],
      ),
    );
    root.add(U);
  });
  let flowers = flowerPlacements().map(clearBarnPlant),
    flowerKinds = ["tall", "wide", "low"],
    flowerHeights = models
      .slice(6, 9)
      .map((Y) => new Box3().setFromObject(Y.scene).getSize(new Vector3()).y),
    flowerTiles = new Map<string, Placement[]>();
  for (let Y of flowers) {
    let j = `${Y.kind}/${Math.floor(Y.x / 10)},${Math.floor(Y.z / 10)}`;
    flowerTiles.has(j) || flowerTiles.set(j, []);
    flowerTiles.get(j)!.push(Y);
  }
  for (let Y of flowerTiles.values()) {
    let j = flowerKinds.indexOf(Y[0].kind),
      c = new Group(),
      U = Array.from(
        {
          length: 3,
        },
        () => new Group(),
      ),
      x = new Vector3(),
      L = 0;
    Y.forEach((p) => {
      x.add(new Vector3(p.x, groundHeight(p.x, p.z), p.z));
      L = Math.max(L, flowerHeights[j] * p.scale);
    });
    x.divideScalar(Y.length);
    x.y += L * 0.5;
    U.forEach((p, d) => {
      instantiate(models[6 + d * 3 + j].scene, Y, p, 0, 0, true);
      c.add(p);
    });
    root.add(c);
    details.push(new ScreenDetail(U, x, L, [95, 28]));
  }
  return {
    trees: TREE_PLACEMENTS,
    flowerCount: flowers.length,
    meshes: meshCount,
    update(Y: PerspectiveCamera, j: number) {
      details.forEach((c) => c.update(Y, j));
    },
  };
}
