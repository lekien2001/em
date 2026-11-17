import type { Material, Mesh, Object3D } from "three";
export function harmonize(root: Object3D) {
  let groundNormal: unknown;
  root.traverse((o) => {
    if (o.name === "Seamless radial terrain")
      groundNormal = (
        (o as Mesh).material as Material & {
          normalMap: unknown;
        }
      ).normalMap;
  });
  const seen = new Set<Material>();
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    for (const mat of Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material]) {
      if (seen.has(mat)) continue;
      seen.add(mat);
      const m = mat as Material & {
        roughness?: number;
        sheen?: number;
        sheenRoughness?: number;
        normalScale?: {
          set: (x: number, y: number) => void;
        };
      };
      if (/canopy/i.test(m.name)) {
        m.roughness = 0.98;
        if (m.sheen !== undefined) m.sheen = 0.22;
        if (m.sheenRoughness !== undefined) m.sheenRoughness = 0.97;
        m.normalScale?.set(0.25, 0.25);
      }
      if (/felt wool/i.test(m.name)) {
        m.roughness = 0.97;
        if (m.sheen !== undefined) m.sheen = 0.38;
        if (m.sheenRoughness !== undefined) m.sheenRoughness = 0.97;
        m.normalScale?.set(0.12, 0.12);
      } else if (/beige felt|pink cheeks|brown smile/i.test(m.name)) {
        m.roughness = 0.96;
        if (m.sheen !== undefined) m.sheen = 0.18;
        if (m.sheenRoughness !== undefined) m.sheenRoughness = 0.97;
      }
      if (
        mesh.name === "Merged barn wood" ||
        /^(entry|exit) door /.test(mesh.name)
      ) {
        m.roughness = 0.99;
        m.normalScale?.set(0.18, 0.18);
      }
      if (mesh.name === "Merged barn roof") {
        m.roughness = 1;
        m.normalScale?.set(0.16, 0.16);
      }
      if (
        groundNormal &&
        (
          m as Material & {
            normalMap?: unknown;
          }
        ).normalMap === groundNormal
      )
        m.normalScale?.set(0.42, 0.42);
    }
  });
}
