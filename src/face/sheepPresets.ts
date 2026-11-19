import { BufferGeometry, CatmullRomCurve3, Color, Float32BufferAttribute, Matrix4, SphereGeometry, Vector3 } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { release } from "../assets/dispose";
import { FACE_MODEL } from "./modelConfig";

export const SHEEP_FACE_STYLES = ["goatee", "curled-moustache", "full-beard"] as const;
export type SheepFaceStyle = typeof SHEEP_FACE_STYLES[number];

// Sculpt in the original GLB's bind pose where +Z is forward and +Y is up.
const FELT = {
  snout: 0xca9591,
  nose: 0xd5a29b,
  mouthCrease: 0xa47871,
  eyebrow: 0x624537,
  upperLid: 0x8b5b4c,
  lowerLid: 0xb08070,
  sclera: 0xf4e5d8,
  pupil: 0x372822,
  hair: 0x846c5c,
};
const MUZZLE = { y: 1.281, z: 1.120, width: .365, height: .216, depth: .205 };
const front = (x: number, y: number) => FACE_MODEL.center[2] + FACE_MODEL.radii[2] * Math.sqrt(Math.max(0,
  1 - (x / FACE_MODEL.radii[0]) ** 2 - ((y - FACE_MODEL.center[1]) / FACE_MODEL.radii[1]) ** 2,
));
const mouthLine = (x: number) => 1.224 + .011 * (x / MUZZLE.width) ** 2;
const lipVolume = (x: number, y: number) => {
  const edge = Math.max(0, 1 - (x / .34) ** 4);
  const relative = y - mouthLine(x);
  const upper = Math.exp(-(((relative - .025) / .026) ** 2));
  const lower = Math.exp(-(((relative + .028) / .022) ** 2));
  return edge * (.056 * upper + .048 * lower);
};
const muzzleFront = (x: number, y: number) => {
  const depth = Math.sqrt(Math.max(0, 1 - (x / MUZZLE.width) ** 2 - ((y - MUZZLE.y) / MUZZLE.height) ** 2));
  return MUZZLE.z + depth * (MUZZLE.depth + lipVolume(x, y));
};

type SurfacePoint = readonly [x: number, y: number, z: number];
type Profile = readonly [x: number, y: number, z: number, width: number, depth: number];

export function createSheepFringe(toHead: Matrix4) {
  const parts = [
    [-.263, 1.880, .990, .121, .111, .150],
    [-.108, 1.915, 1.034, .132, .128, .159],
    [.073, 1.906, 1.044, .139, .133, .162],
    [.245, 1.871, 1.000, .121, .113, .150],
  ].map(([x, y, z, sx, sy, sz]) => new SphereGeometry(1, 20, 14).scale(sx, sy, sz).translate(x, y, z));
  const fringe = mergeGeometries(parts)!;
  parts.forEach(release);
  fringe.applyMatrix4(toHead);
  fringe.computeBoundingSphere();
  return fringe;
}

/** A smooth solid with tapered ends, measured perpendicular to its center line in the face plane. */
function feltStroke(profile: readonly Profile[], segments = 16, sides = 10) {
  const path = new CatmullRomCurve3(profile.map(([x, y, z]) => new Vector3(x, y, z)), false, "catmullrom", .5);
  const positions: number[] = [], uv: number[] = [], index: number[] = [];
  for (let row = 0; row <= segments; row++) {
    const t = row / segments;
    const center = path.getPoint(t), tangent = path.getTangent(t);
    const length = Math.hypot(tangent.x, tangent.y) || 1;
    const at = t * (profile.length - 1);
    const i = Math.min(Math.floor(at), profile.length - 2);
    const phase = at - i, smooth = phase * phase * (3 - 2 * phase);
    const width = profile[i][3] + (profile[i + 1][3] - profile[i][3]) * smooth;
    const depth = profile[i][4] + (profile[i + 1][4] - profile[i][4]) * smooth;
    for (let j = 0; j <= sides; j++) {
      const angle = j / sides * Math.PI * 2;
      const across = Math.cos(angle) * width;
      positions.push(center.x - tangent.y / length * across, center.y + tangent.x / length * across, center.z + Math.sin(angle) * depth);
      uv.push(t, j / sides);
      if (row > 0 && j > 0) {
        const a = row * (sides + 1) + j;
        index.push(a - sides - 2, a - sides - 1, a, a - sides - 2, a, a - 1);
      }
    }
  }
  const mesh = new BufferGeometry();
  mesh.setAttribute("position", new Float32BufferAttribute(positions, 3));
  mesh.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  mesh.setIndex(index);
  mesh.computeVertexNormals();
  return mesh;
}

/** A convex felt applique on the head, with a separate pupil cropped by the eyelids. */
function eyePatch(point: (u: number, v: number) => SurfacePoint) {
  const columns = 20, rows = 5, positions: number[] = [], uv: number[] = [], index: number[] = [];
  for (let row = 0; row <= rows; row++) for (let column = 0; column <= columns; column++) {
    positions.push(...point(2 * column / columns - 1, row / rows));
    uv.push(column / columns, row / rows);
    if (row > 0 && column > 0) {
      const a = row * (columns + 1) + column;
      index.push(a - columns - 2, a - columns - 1, a, a - columns - 2, a, a - 1);
    }
  }
  const mesh = new BufferGeometry();
  mesh.setAttribute("position", new Float32BufferAttribute(positions, 3));
  mesh.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  mesh.setIndex(index);
  mesh.computeVertexNormals();
  return mesh;
}

export function createSheepFaceGeometry(style: SheepFaceStyle, toHead: Matrix4) {
  const parts: BufferGeometry[] = [];
  const add = (geometry: BufferGeometry, color: number) => {
    const { r, g, b } = new Color(color);
    const count = geometry.getAttribute("position").count;
    const colors = new Float32Array(3 * count);
    for (let i = 0; i < colors.length; i += 3) {
      colors[i] = r;
      colors[i + 1] = g;
      colors[i + 2] = b;
    }
    geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
    parts.push(geometry);
  };
  const snoutStroke = (outline: readonly (readonly [number, number, number, number])[], color: number, offset = 0) => {
    add(feltStroke(outline.map(([x, y, width, depth]) => [x, y, muzzleFront(x, y) + offset, width, depth])), color);
  };

  if (style === "full-beard") {
    // A continuous band around the jaw, anchored below each ear and rounded under the chin.
    add(feltStroke([
      [-.41, 1.545, .95, .003, .004], [-.395, 1.452, 1.03, .040, .053],
      [-.36, 1.325, 1.115, .067, .071], [-.31, 1.18, 1.12, .082, .089], [-.19, 1.073, 1.16, .080, .097],
      [0, 1.043, 1.174, .072, .103], [.19, 1.073, 1.16, .080, .097],
      [.31, 1.18, 1.12, .082, .089], [.36, 1.325, 1.115, .067, .071],
      [.395, 1.452, 1.03, .040, .053], [.41, 1.545, .95, .003, .004],
    ], 36, 12), FELT.hair);
  }
  const snout = new SphereGeometry(1, 44, 38);
  const vertices = snout.getAttribute("position");
  for (let i = 0; i < vertices.count; i++) {
    const x = vertices.getX(i) * MUZZLE.width;
    const y = MUZZLE.y + vertices.getY(i) * MUZZLE.height;
    const z = vertices.getZ(i);
    vertices.setXYZ(i, x, y, MUZZLE.z + z * (MUZZLE.depth + (z > 0 ? lipVolume(x, y) : 0)));
  }
  snout.computeVertexNormals();
  add(snout, FELT.snout);
  const mouth: Profile[] = [-.30, -.24, -.12, 0, .12, .24, .30].map(x => {
    const y = mouthLine(x), width = .001 + .004 * (1 - (x / .30) ** 2);
    return [x, y, muzzleFront(x, y) + .004, width, .006];
  });
  add(feltStroke(mouth, 24), FELT.mouthCrease);

  if (style === "goatee") {
    add(feltStroke([[0, 1.093, 1.242, .078, .043], [0, 1.047, 1.236, .056, .056],
      [0, 1.002, 1.225, .033, .042], [0, .963, 1.218, .002, .003]], 14), FELT.hair);
  } else {
    for (const side of [-1, 1]) {
      const shape = style === "curled-moustache"
        ? [[.005, 1.345, .020, .017], [.068, 1.344, .046, .034], [.145, 1.312, .056, .042], [.220, 1.321, .047, .043],
          [.272, 1.363, .031, .034], [.267, 1.412, .023, .026], [.235, 1.424, .014, .018], [.218, 1.403, .009, .013], [.230, 1.390, .002, .004]] as const
        : [[.006, 1.35, .015, .012], [.069, 1.351, .035, .030], [.144, 1.334, .037, .035],
          [.211, 1.315, .025, .027], [.268, 1.294, .003, .004]] as const;
      add(feltStroke(shape.map(([x, y, width, depth]) => [side * x, y, muzzleFront(x, y) + .009, width, depth]), 30), FELT.hair);
    }
  }
  snoutStroke([[-.185, 1.373, .005, .005], [-.124, 1.411, .034, .041], [-.060, 1.401, .038, .053],
    [0, 1.376, .040, .061], [.060, 1.401, .038, .053], [.124, 1.411, .034, .041], [.185, 1.373, .005, .005]], FELT.nose, -.007);

  const sideGlance = style === "goatee" ? .045 : style === "full-beard" ? -.045 : 0;
  for (const side of [-1, 1]) {
    const eyeX = side * .178, eyeY = 1.594 + side * .006, eyeWidth = .144;
    const bounds = (x: number) => {
      const t = (x - eyeX) / eyeWidth;
      const arc = Math.sqrt(Math.max(0, 1 - t * t));
      const center = eyeY + .008 * t * side;
      return [center - .046 * arc, center + .022 * arc];
    };
    const eyeDepth = (x: number, y: number) => {
      const [low, high] = bounds(x);
      const t = (x - eyeX) / eyeWidth;
      const v = (y - low) / Math.max(.001, high - low);
      return front(x, y) + .006 + .010 * Math.sqrt(Math.max(0, 1 - t * t)) * Math.sin(Math.PI * v);
    };
    add(eyePatch((u, v) => {
      const x = eyeX + u * eyeWidth;
      const [low, high] = bounds(x), y = low + (high - low) * v;
      return [x, y, eyeDepth(x, y)];
    }), FELT.sclera);
    add(eyePatch((u, v) => {
      const x = eyeX + sideGlance + u * .061;
      const [low, high] = bounds(x);
      const radius = .055 * Math.sqrt(1 - u * u);
      const center = eyeY + .006;
      const below = Math.max(low, center - radius), above = Math.min(high, center + radius);
      const y = below + (above - below) * v;
      return [x, y, eyeDepth(x, y) + .0028];
    }), FELT.pupil);
    for (const edge of [0, 1]) {
      const edgeLine: Profile[] = Array.from({ length: 13 }, (_, i) => {
        const t = (i - 6) / 6;
        const x = eyeX + eyeWidth * t, y = bounds(x)[edge];
        const width = .001 + (edge === 1 ? .009 : .004) * Math.sqrt(1 - t * t);
        return [x, y, eyeDepth(x, y), width, width];
      });
      add(feltStroke(edgeLine, 16, 8), edge ? FELT.upperLid : FELT.lowerLid);
    }
    const brow: Profile[] = [-1, -.5, 0, .5, 1].map(t => {
      const x = eyeX + .126 * t;
      const y = eyeY + .116 + .006 * (1 - t * t) + t * (side === -1 ? .004 : -.013);
      const width = .001 + .011 * Math.sqrt(1 - t * t);
      return [x, y, front(x, y) + .006, width, width * .82];
    });
    add(feltStroke(brow, 16, 8), FELT.eyebrow);
  }

  const geometry = mergeGeometries(parts)!;
  parts.forEach(release);
  geometry.applyMatrix4(toHead);
  geometry.computeBoundingSphere();
  return geometry;
}
