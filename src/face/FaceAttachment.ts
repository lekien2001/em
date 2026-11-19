import { Bone, BufferGeometry, CanvasTexture, Float32BufferAttribute, FrontSide, Group, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, SkinnedMesh, SphereGeometry, SRGBColorSpace, Vector2, Vector3, type Object3D, type Material } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { release } from "../assets/dispose";
import type { FaceAppearance } from "../types";
import { FACE_MODEL as C } from "./modelConfig";
import { createSheepFaceGeometry, createSheepFringe, type SheepFaceStyle } from "./sheepPresets";
type Binding = {
  mesh: SkinnedMesh;
  original: BufferGeometry;
  filtered: BufferGeometry;
};
/** Connected components matter: ear roots may have Head-only weights while the
 * rest blends to EarL/R. Keep each entire ear, including those root triangles. */
export function withoutFaceFeatures(mesh: SkinnedMesh, head: Bone): BufferGeometry {
  const geometry = mesh.geometry,
    index = geometry.index;
  const joints = geometry.getAttribute("skinIndex"),
    weights = geometry.getAttribute("skinWeight");
  const headIndex = mesh.skeleton.bones.indexOf(head);
  if (!index || !joints || !weights || headIndex < 0) throw new Error("Cấu trúc mặt cừu không tương thích.");
  const positions = geometry.getAttribute("position"),
    parents = Array.from({
      length: positions.count
    }, (_, i) => i),
    welded = new Map<string, number>();
  const find = (i: number): number => {
    while (parents[i] !== i) {
      parents[i] = parents[parents[i]];
      i = parents[i];
    }
    return i;
  };
  const union = (a: number, b: number) => {
    parents[find(a)] = find(b);
  };
  for (let i = 0; i < positions.count; i++) {
    const key = [positions.getX(i), positions.getY(i), positions.getZ(i)].map(v => v.toFixed(5)).join(",");
    const other = welded.get(key);
    if (other === undefined) welded.set(key, i);else union(i, other);
  }
  for (let i = 0; i < index.count; i += 3) {
    union(index.getX(i), index.getX(i + 1));
    union(index.getX(i), index.getX(i + 2));
  }
  const owned = (vertex: number) => {
    let total = 0;
    for (let k = 0; k < 4; k++) if (joints.getComponent(vertex, k) === headIndex) total += weights.getComponent(vertex, k);
    return total > .9999;
  };
  const components = new Map<number, boolean>();
  for (let i = 0; i < positions.count; i++) {
    const key = find(i);
    components.set(key, (components.get(key) ?? true) && owned(i));
  }
  const kept: number[] = [];
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i),
      b = index.getX(i + 1),
      c = index.getX(i + 2);
    if (!components.get(find(a))) kept.push(a, b, c);
  }
  if (kept.length === index.count) throw new Error("Không tìm thấy nét mặt cừu gốc.");
  const copy = geometry.clone();
  copy.setIndex(kept);
  copy.computeBoundingSphere();
  return copy;
}
function surface(x: number, y: number, offset: number = C.offset) {
  return C.center[2] + C.radii[2] * Math.sqrt(Math.max(.015, 1 - (x / C.radii[0]) ** 2 - ((y - C.center[1]) / C.radii[1]) ** 2)) + offset;
}
function photoGeometry(toHead: Matrix4) {
  const positions: number[] = [],
    uv: number[] = [],
    indices: number[] = [];
  for (let r = 0; r <= C.rings; r++) for (let i = 0; i <= C.segments; i++) {
    const radius = r / C.rings,
      angle = i / C.segments * Math.PI * 2;
    const u = radius * Math.cos(angle),
      v = radius * Math.sin(angle);
    const x = u * C.photoRadii[0],
      y = C.center[1] + v * C.photoRadii[1];
    const p = new Vector3(x, y, surface(x, y)).applyMatrix4(toHead);
    positions.push(p.x, p.y, p.z);
    uv.push(.5 + u / 2, .5 + v / 2);
    if (r > 0 && i > 0) {
      const a = r * (C.segments + 1) + i;
      indices.push(a, a - C.segments - 2, a - 1, a, a - C.segments - 1, a - C.segments - 2);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}
function rimGeometry(toHead: Matrix4) {
  const parts: BufferGeometry[] = [];
  for (let i = 0; i < C.rimCount; i++) {
    const angle = i / C.rimCount * Math.PI * 2;
    const x = (C.photoRadii[0] + .026) * Math.cos(angle),
      y = C.center[1] + (C.photoRadii[1] + .004) * Math.sin(angle);
    const size = C.rimRadius * (1 + .11 * Math.sin(i * 2.37));
    const p = new SphereGeometry(size, 12, 8);
    p.scale(1, .94, .78);
    p.translate(x, y, surface(x, y, .004));
    p.applyMatrix4(toHead);
    parts.push(p);
  }
  const geometry = mergeGeometries(parts)!;
  parts.forEach(release);
  return geometry;
}

/** One set of owned resources for all three actors. Borrowed model textures and
 * original geometries are never released here; only this feature's copies are. */
export class FaceAttachment {
  private groups: Group[] = [];
  private presets: Mesh[] = [];
  private presetGeometries = new Map<SheepFaceStyle, BufferGeometry>();
  private presetMaterial: MeshStandardMaterial;
  private fringe: BufferGeometry;
  private bindings: Binding[] = [];
  private filtered = new Map<BufferGeometry, BufferGeometry>();
  private geometry: BufferGeometry;
  private rim: BufferGeometry;
  private material: MeshBasicMaterial;
  private wool: Material;
  private texture?: CanvasTexture;
  private applied: FaceAppearance | null = null;
  private disposed = false;
  private visible = false;
  constructor(roots: Object3D[], styles: readonly SheepFaceStyle[]) {
    if (styles.length !== roots.length) throw new Error("Số kiểu mặt cừu không khớp mô hình.");
    const first = roots[0],
      head = first.getObjectByName(C.head);
    if (!(head instanceof Bone)) throw new Error("Không tìm thấy xương đầu cừu tương thích.");
    let source: SkinnedMesh | undefined, wool: Material | undefined;
    first.traverse(node => {
      if (node instanceof SkinnedMesh) {
        source ??= node;
        if (!Array.isArray(node.material) && node.material.name === C.wool) wool = node.material;
      }
    });
    if (!source || !wool) throw new Error("Không tìm thấy bề mặt đầu cừu tương thích.");
    const boneIndex = source.skeleton.bones.indexOf(head);
    const toHead = source.skeleton.boneInverses[boneIndex].clone().multiply(source.bindMatrix);
    const candidates: {
      mesh: SkinnedMesh;
      original: BufferGeometry;
    }[] = [];
    for (const root of roots) {
      if (!(root.getObjectByName(C.head) instanceof Bone)) throw new Error("Cấu trúc đầu cừu không đồng nhất.");
      root.traverse(node => {
        if (node instanceof SkinnedMesh && !Array.isArray(node.material) && (C.features as readonly string[]).includes(node.material.name)) candidates.push({
          mesh: node,
          original: node.geometry
        });
      });
    }
    if (candidates.length !== roots.length * 2) throw new Error("Vật liệu mặt cừu không tương thích.");
    try {
      for (const {
        mesh,
        original
      } of candidates) {
        let filtered = this.filtered.get(original);
        if (!filtered) {
          filtered = withoutFaceFeatures(mesh, mesh.skeleton.bones.find(b => b.name === C.head)!);
          this.filtered.set(original, filtered);
        }
        this.bindings.push({
          mesh,
          original,
          filtered
        });
      }
    } catch (error) {
      this.filtered.forEach(release);
      throw error;
    }
    this.geometry = photoGeometry(toHead);
    this.rim = rimGeometry(toHead);
    this.material = new MeshBasicMaterial({
      transparent: true,
      depthWrite: false,
      side: FrontSide,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    });
    this.wool = wool.clone();
    if (this.wool instanceof MeshStandardMaterial) this.wool.roughness = .95;
    this.fringe = createSheepFringe(toHead);
    this.presetMaterial = new MeshStandardMaterial({
      vertexColors: true,
      roughness: .9,
      normalMap: wool instanceof MeshStandardMaterial ? wool.normalMap : null,
      normalScale: new Vector2(.28, .28),
    });
    this.bindings.forEach(binding => { binding.mesh.geometry = binding.filtered; });
    for (const [index, root] of roots.entries()) {
      const bone = root.getObjectByName(C.head)!;
      const style = styles[index];
      let geometry = this.presetGeometries.get(style);
      if (!geometry) {
        geometry = createSheepFaceGeometry(style, toHead);
        this.presetGeometries.set(style, geometry);
      }
      const preset = new Mesh(geometry, this.presetMaterial);
      preset.name = `Felt sheep face · ${style}`;
      preset.castShadow = preset.receiveShadow = true;
      const fringe = new Mesh(this.fringe, this.wool);
      fringe.name = "Felt forehead tufts";
      fringe.castShadow = fringe.receiveShadow = true;
      preset.add(fringe);
      bone.add(preset);
      this.presets.push(preset);
      const group = new Group();
      group.name = "Personal face";
      group.visible = false;
      const face = new Mesh(this.geometry, this.material);
      face.name = "Photo surface";
      const rim = new Mesh(this.rim, this.wool);
      rim.name = "Felt face rim";
      group.add(face, rim);
      bone.add(group);
      this.groups.push(group);
    }
  }
  set(face: FaceAppearance | null) {
    if (this.disposed || this.applied === face) return;
    const next = face ? new CanvasTexture(face.canvas) : undefined;
    if (next) {
      next.colorSpace = SRGBColorSpace;
      next.anisotropy = 4;
    }
    this.material.map = next ?? null;
    this.material.needsUpdate = true;
    this.texture && release(this.texture);
    this.texture = next;
    this.show(!!face);
    this.applied = face;
  }
  /** Keep a single texture and shader variant while editing the same canvas. */
  updatePreview(face: FaceAppearance, hasPhoto: boolean) {
    if (this.disposed) return;
    if (this.applied !== face) this.set(face);
    if (hasPhoto && this.texture) this.texture.needsUpdate = true;
    this.show(hasPhoto);
  }
  private show(visible: boolean) {
    if (this.visible === visible) return;
    this.visible = visible;
    this.presets.forEach(preset => { preset.visible = !visible; });
    this.groups.forEach(group => { group.visible = visible; });
  }
  dispose() {
    if (this.disposed) return;
    this.set(null);
    this.disposed = true;
    this.groups.forEach(g => g.removeFromParent());
    this.groups.length = 0;
    this.presets.forEach(preset => preset.removeFromParent());
    this.presets.length = 0;
    this.presetGeometries.forEach(release);
    this.presetGeometries.clear();
    release(this.presetMaterial);
    release(this.fringe);
    this.bindings.forEach(binding => { binding.mesh.geometry = binding.original; });
    this.filtered.forEach(release);
    this.filtered.clear();
    this.bindings.length = 0;
    release(this.geometry);
    release(this.rim);
    release(this.material);
    release(this.wool);
  }
}
