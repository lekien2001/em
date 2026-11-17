import {
  InstancedMesh,
  Mesh,
  Points,
  SkinnedMesh,
  Sprite,
  Texture,
  type BufferGeometry,
  type Material,
  type Object3D,
  type Skeleton,
} from "three";
// Object identity, not URL: shared cloned resources are released exactly once.
const released = new WeakSet<object>();
export function release(resource: { dispose(): void }) {
  if (released.has(resource)) return;
  released.add(resource);
  resource.dispose();
}
export function disposeMaterial(material: Material) {
  for (const value of Object.values(material))
    if (value instanceof Texture) release(value);
  release(material);
}
export function disposeObject(root: Object3D) {
  const geometry = new Set<BufferGeometry>(),
    materials = new Set<Material>(),
    skeletons = new Set<Skeleton>();
  root.traverse((node) => {
    if (node instanceof Sprite) materials.add(node.material);
    if (node instanceof Mesh || node instanceof Points) {
      geometry.add(node.geometry);
      for (const mat of Array.isArray(node.material)
        ? node.material
        : [node.material])
        materials.add(mat);
    }
    if (node instanceof SkinnedMesh) skeletons.add(node.skeleton);
    if (node instanceof InstancedMesh) release(node);
  });
  geometry.forEach(release);
  materials.forEach(disposeMaterial);
  skeletons.forEach(release);
}
