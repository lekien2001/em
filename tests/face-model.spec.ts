import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import { Bone, Matrix4, Mesh, SkinnedMesh, Texture, Vector3 } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { SheepActor } from "../src/scene/sheep/SheepActor";
import { FaceAttachment } from "../src/face/FaceAttachment";
import { FACE_MODEL } from "../src/face/modelConfig";
test("real GLB: face filtering preserves complete ears/hooves; attachments follow Head in every clip and restore exact resources", async () => {
  const loader = new GLTFLoader();
  loader.register(() => ({
    name: "inspect-texture-free",
    loadTexture: async () => new Texture()
  }));
  const bytes = await fs.readFile("public/assets/sheep-natural.glb"),
    model = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
  const actors = Array.from({
    length: 3
  }, () => new SheepActor(model));
  const originals = new Map<SkinnedMesh, any>();
  actors.forEach(a => a.root.traverse(node => {
    if (node instanceof SkinnedMesh) originals.set(node, node.geometry);
  }));
  const attachment = new FaceAttachment(actors.map(a => a.root));
  const released = new Map<any, number>();
  const watch = (value: any) => {
    if (!released.has(value)) {
      released.set(value, 0);
      value.addEventListener("dispose", () => released.set(value, released.get(value)! + 1));
    }
  };
  originals.forEach(geometry => watch(geometry));
  for (let turn = 0; turn < 30; turn++) {
    attachment.set({
      canvas: {
        width: 768,
        height: 1024
      } as HTMLCanvasElement,
      revision: turn
    });
    actors.forEach(actor => {
      const head = actor.root.getObjectByName("Head") as Bone,
        group = head.getObjectByName("Personal face")!;
      expect(group.visible).toBe(true);
      expect(head.children.filter(c => c.name === "Personal face")).toHaveLength(1);
      group.traverse(n => {
        if (n instanceof Mesh) {
          watch(n.geometry);
          watch(n.material);
          const map = (n.material as any).map;
          if (map) watch(map);
        }
      });
      actor.root.traverse(node => {
        if (!(node instanceof SkinnedMesh) || Array.isArray(node.material)) return;
        const original = originals.get(node);
        if (!(FACE_MODEL.features as readonly string[]).includes(node.material.name)) {
          expect(node.geometry).toBe(original);
          return;
        }
        watch(node.geometry);
        expect(node.geometry.index!.count).toBeLessThan(original.index.count);
        // Remaining ear and hoof triangles must be byte-for-byte identical.
        const expected: number[] = [],
          positions = original.attributes.position;
        for (let i = 0; i < original.index.count; i += 3) {
          const ids = [0, 1, 2].map(k => original.index.getX(i + k));
          // Independent spatial check against measured GLB bounds: ears z<1,
          // cheeks z>1.14; hooves y<.24, facial marks y>1.26.
          if (ids.every(id => node.material.name.startsWith("Soft pink") ? positions.getZ(id) < 1 : positions.getY(id) < .25)) expected.push(...ids);
        }
        expect(Array.from(node.geometry.index!.array)).toEqual(expected);
      });
      for (const state of ["Idle", "Walk", "Jump", "Land"] as const) {
        for (const time of [0, .2, .7]) {
          actor.pose(state, time, .21, 1, true);
          actor.root.updateMatrixWorld(true);
          const local = group.matrix.clone(),
            world = new Matrix4().multiplyMatrices(head.matrixWorld, local);
          expect(group.matrixWorld.toArray()).toEqual(world.toArray());
          const surface = group.getObjectByName("Photo surface") as Mesh;
          const p = new Vector3().fromBufferAttribute(surface.geometry.getAttribute("position"), 0).applyMatrix4(head.matrixWorld);
          expect(p.toArray().every(Number.isFinite)).toBe(true);
        }
      }
    });
    attachment.set(null);
    originals.forEach((geometry, mesh) => expect(mesh.geometry).toBe(geometry));
  }
  attachment.dispose();
  attachment.dispose();
  originals.forEach(geometry => expect(released.get(geometry)).toBe(0));
  // Borrowed wool texture is also not owned by the feature.
  released.forEach((count, resource) => {
    if (![...originals.values()].includes(resource) && resource instanceof Texture && resource.image === null) expect(count).toBe(0);else if (![...originals.values()].includes(resource)) expect(count).toBe(1);
  });
  actors.forEach(a => a.dispose());
});
