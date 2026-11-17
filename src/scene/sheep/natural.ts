import {
  Quaternion,
  Vector3,
  type AnimationAction,
  type AnimationMixer,
  type Bone,
  type Object3D,
  type SkinnedMesh,
} from "three";
export type State = "Idle" | "Walk" | "Jump" | "Land";
export type Pose = {
  x: number;
  z: number;
  y: number;
  yaw: number;
  state: State;
  clipTime: number;
  visible: boolean;
};
export type Actor = {
  root: Object3D;
  mixer: AnimationMixer;
  actions: Record<State, AnimationAction>;
  active: State;
  pose: (
    state: State,
    time: number,
    delta: number,
    rate: number,
    visible: boolean,
  ) => void;
  reset(): void;
  poseLayer?: {
    restoreBase(): void;
    captureBase(): void;
  };
};
export type Barn = {
  id: string;
  x: number;
  z: number;
  yaw: number;
};
export type Adapters = {
  groundHeight: (x: number, z: number) => number;
  meadowHeight: (x: number, z: number) => number;
  getPose: (phase: number, index: number) => Pose;
  getAge: (phase: number, index: number) => number;
  walkDistance: (age: number) => number;
  barns: Barn[];
};
type FootCalibration = {
  name: string;
  local: Vector3;
  centre: number;
  offset: Vector3;
  pole: number;
};
const clamp = (v: number) => Math.max(0, Math.min(1, v));
export const smooth = (a: number, b: number, v: number) => {
  const p = clamp((v - a) / (b - a));
  return p * p * (3 - 2 * p);
};
const wrap = (v: number) => v - Math.floor(v + 0.5);
const legNames = ["FrontL", "BackL", "FrontR", "BackR"];
const STRIDE = 1.05;

/** A source-derived arc table: contact locations are computed from time/distance,
 * never integrated per frame. Delayed frames and pause cannot drift a foot. */
class ArcTable {
  readonly rows: {
    time: number;
    distance: number;
    x: number;
    z: number;
    yaw: number;
  }[] = [];
  constructor(
    readonly start: number,
    readonly end: number,
    a: Adapters,
  ) {
    for (let i = 0; i <= 512; i++) {
      const time = start + ((end - start) * i) / 512,
        q = a.getPose(Math.min(time, end - 1e-9), 0);
      this.rows.push({
        time,
        distance: a.walkDistance(Math.min(time, end - 1e-9)),
        x: q.x,
        z: q.z,
        yaw: q.yaw,
      });
    }
  }
  sample(
    distance: number,
    out: {
      x: number;
      z: number;
      yaw: number;
    },
  ) {
    const rows = this.rows;
    distance = Math.max(0, Math.min(distance, rows[rows.length - 1].distance));
    let lo = 0,
      hi = rows.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (rows[mid].distance < distance) lo = mid;
      else hi = mid;
    }
    const a = rows[lo],
      b = rows[hi],
      p = (distance - a.distance) / Math.max(1e-9, b.distance - a.distance);
    out.x = a.x + (b.x - a.x) * p;
    out.z = a.z + (b.z - a.z) * p;
    out.yaw = a.yaw + (b.yaw - a.yaw) * p;
  }
}
function calibrate(actor: Actor, a: Adapters): FootCalibration[] {
  actor.root.updateMatrixWorld(true);
  const meshes: SkinnedMesh[] = [];
  actor.root.traverse((o) => {
    if ((o as SkinnedMesh).isSkinnedMesh) meshes.push(o as SkinnedMesh);
  });
  const feet = legNames.map((name) => {
    const bone = actor.root.getObjectByName(name + "Lower") as Bone,
      index = meshes[0].skeleton.bones.indexOf(bone),
      candidates: Vector3[] = [];
    if (!bone || index < 0)
      throw new Error("Original leg rig missing: " + name);
    for (const mesh of meshes) {
      const p = mesh.geometry.attributes.position,
        si = mesh.geometry.attributes.skinIndex,
        sw = mesh.geometry.attributes.skinWeight;
      for (let v = 0; v < p.count; v++)
        if (
          [0, 1, 2, 3].some(
            (c) =>
              si.getComponent(v, c) === index && sw.getComponent(v, c) > 0.5,
          )
        )
          candidates.push(
            mesh
              .getVertexPosition(v, new Vector3())
              .applyMatrix4(mesh.matrixWorld),
          );
    }
    const bottom = Math.min(...candidates.map((p) => p.y)),
      sole = candidates.filter((p) => p.y < bottom + 0.025),
      point = sole
        .reduce((p, v) => p.add(v), new Vector3())
        .divideScalar(sole.length);
    return {
      name,
      local: bone.worldToLocal(point),
      centre: 0,
      offset: new Vector3(),
      pole: 1,
    };
  });
  Object.values(actor.actions).forEach((action) =>
    action.setEffectiveWeight(0),
  );
  const walk = actor.actions.Walk;
  walk.setEffectiveWeight(1);
  walk.enabled = true;
  walk.paused = true;
  const curves: Vector3[][] = feet.map(() => []),
    steps = 128;
  for (let k = 0; k < steps; k++) {
    walk.time = k / steps;
    actor.mixer.update(0);
    actor.root.updateMatrixWorld(true);
    feet.forEach((f, i) => {
      const bone = actor.root.getObjectByName(f.name + "Lower")!;
      curves[i].push(
        actor.root.worldToLocal(bone.localToWorld(f.local.clone())),
      );
    });
  }
  feet.forEach((f, i) => {
    const curve = curves[i];
    let min = Infinity,
      index = 0;
    // A hoof is in stance when moving backwards relative to the body. Selecting
    // only its lowest Y would incorrectly select the forward swing of this clip.
    const hip = actor.root.worldToLocal(
      actor.root
        .getObjectByName(f.name + "Upper")!
        .getWorldPosition(new Vector3()),
    );
    for (let k = 0; k < steps; k++) {
      const speed = curve[(k + 1) % steps].z - curve[(k + steps - 1) % steps].z,
        score = Math.abs(curve[k].z - hip.z);
      if (speed < -0.003 && score < min) {
        min = score;
        index = k;
      }
    }
    f.centre = index / steps;
    f.offset.copy(curve[index]);
    walk.time = f.centre;
    actor.mixer.update(0);
    actor.root.updateMatrixWorld(true);
    const upper = actor.root.getObjectByName(f.name + "Upper")!,
      lower = actor.root.getObjectByName(f.name + "Lower")!,
      h = upper.getWorldPosition(new Vector3()),
      k = lower.getWorldPosition(new Vector3()),
      p = lower.localToWorld(f.local.clone()),
      dir = p.clone().sub(h).normalize(),
      bend = k.clone().sub(h).addScaledVector(dir, -k.clone().sub(h).dot(dir));
    f.pole = bend.z < 0 ? -1 : 1;
  });
  actor.reset();
  actor.root.updateMatrixWorld(true);
  return feet;
}
export class NaturalSheep {
  readonly diagnostics = {
    state: "Idle" as State,
    feet: legNames.map((name) => ({
      name,
      stance: 0,
      error: 0,
      groundError: 0,
    })),
    headYaw: 0,
    earL: 0,
    earR: 0,
  };
  private readonly legs: {
    upper: Bone;
    lower: Bone;
    calibration: FootCalibration;
  }[];
  private readonly head: Bone;
  private readonly body: Bone;
  private readonly ears: Bone[];
  private readonly v: Vector3[];
  private readonly q: Quaternion[];
  private readonly anchor = {
    x: 0,
    z: 0,
    yaw: 0,
  };
  private readonly base: {
    bone: Bone;
    position: Vector3;
    quaternion: Quaternion;
    scale: Vector3;
  }[] = [];
  constructor(
    readonly actor: Actor,
    readonly index: number,
    private a: Adapters,
    calibration: FootCalibration[],
    private paths: ArcTable[],
  ) {
    this.legs = calibration.map((c) => ({
      upper: actor.root.getObjectByName(c.name + "Upper") as Bone,
      lower: actor.root.getObjectByName(c.name + "Lower") as Bone,
      calibration: c,
    }));
    this.head = actor.root.getObjectByName("Head") as Bone;
    this.body = actor.root.getObjectByName("Body") as Bone;
    this.ears = ["EarL", "EarR"].map(
      (n) => actor.root.getObjectByName(n) as Bone,
    );
    if (this.ears.some((e) => !e))
      throw new Error("Derived ear controls missing");
    this.v = Array.from(
      {
        length: 15,
      },
      () => new Vector3(),
    );
    this.q = Array.from(
      {
        length: 5,
      },
      () => new Quaternion(),
    );
    actor.root.traverse((o) => {
      if ((o as Bone).isBone) {
        const bone = o as Bone;
        this.base.push({
          bone,
          position: bone.position.clone(),
          quaternion: bone.quaternion.clone(),
          scale: bone.scale.clone(),
        });
      }
    });
  }
  // AnimationMixer skips writing unchanged values at a frozen clip time. Restore
  // the last source pose before evaluating it, so additive edits never compound.
  restoreBase() {
    for (const b of this.base) {
      b.bone.position.copy(b.position);
      b.bone.quaternion.copy(b.quaternion);
      b.bone.scale.copy(b.scale);
    }
    this.actor.root.updateMatrixWorld(true);
  }
  captureBase() {
    for (const b of this.base) {
      b.position.copy(b.bone.position);
      b.quaternion.copy(b.bone.quaternion);
      b.scale.copy(b.bone.scale);
    }
  }
  private rotate(bone: Bone, from: Vector3, to: Vector3) {
    const [delta, parent, local] = this.q;
    delta.setFromUnitVectors(from.normalize(), to.normalize());
    bone.parent!.getWorldQuaternion(parent);
    local.copy(parent).invert().multiply(delta).multiply(parent);
    bone.quaternion.premultiply(local).normalize();
    this.actor.root.updateMatrixWorld(true);
  }
  private solve(
    upper: Bone,
    lower: Bone,
    localFoot: Vector3,
    target: Vector3,
    poleSign: number,
  ) {
    const [h, k, f, dir, pole, knee, from, to, adjusted] = this.v;
    upper.getWorldPosition(h);
    lower.getWorldPosition(k);
    f.copy(localFoot).applyMatrix4(lower.matrixWorld);
    const l1 = h.distanceTo(k),
      l2 = k.distanceTo(f),
      distance = h.distanceTo(target),
      r = Math.max(
        Math.abs(l1 - l2) + 0.001,
        Math.min(distance, l1 + l2 - 0.001),
      );
    dir.subVectors(target, h).normalize();
    adjusted.copy(h).addScaledVector(dir, r);
    pole.set(0, 0, poleSign).applyQuaternion(this.actor.root.quaternion);
    pole.addScaledVector(dir, -pole.dot(dir));
    if (pole.lengthSq() < 1e-7) pole.set(1, 0, 0);
    pole.normalize();
    const cos = Math.max(
      -1,
      Math.min(1, (l1 * l1 + r * r - l2 * l2) / (2 * l1 * r)),
    );
    knee
      .copy(h)
      .addScaledVector(dir, l1 * cos)
      .addScaledVector(pole, l1 * Math.sqrt(Math.max(0, 1 - cos * cos)));
    from.subVectors(k, h);
    to.subVectors(knee, h);
    this.rotate(upper, from, to);
    lower.getWorldPosition(k);
    f.copy(localFoot).applyMatrix4(lower.matrixWorld);
    from.subVectors(f, k);
    to.subVectors(adjusted, k);
    this.rotate(lower, from, to);
  }
  update(phase: number, seconds: number, reduced: boolean) {
    this.restoreBase();
    const root = this.actor.root,
      a = this.a,
      age = a.getAge(phase, this.index),
      pose = a.getPose(phase, this.index),
      state = this.actor.active;
    this.diagnostics.state = state;
    // Reset the two additive controls explicitly: the four preserved source clips
    // animate the original joints and intentionally contain no ear tracks.
    this.ears.forEach((e) => e.quaternion.identity());
    if (!root.visible) {
      this.diagnostics.headYaw =
        this.diagnostics.earL =
        this.diagnostics.earR =
          0;
      this.diagnostics.feet.forEach((f) => (f.stance = 0));
      return;
    }
    const walking = state === "Walk",
      idle = state === "Idle";
    const walkBlend = walking
      ? (age < 6.4
          ? smooth(0.8, 1.05, age) * (1 - smooth(6.15, 6.4, age))
          : smooth(9.3, 9.55, age) * (1 - smooth(15.95, 16.2, age))) *
        this.actor.actions.Walk.getEffectiveWeight()
      : 0;
    let doorClear = 1;
    for (const b of a.barns) {
      const dx = pose.x - b.x,
        dz = pose.z - b.z,
        c = Math.cos(b.yaw),
        s = Math.sin(b.yaw),
        x = c * dx - s * dz,
        z = s * dx + c * dz;
      if (Math.abs(x) < 2.7)
        doorClear = Math.min(doorClear, smooth(1.6, 2.5, Math.abs(z - 2.4)));
    }
    const micro =
      reduced || (!walking && !idle)
        ? 0
        : doorClear * (1 - smooth(5.9, 6.3, age)) +
          (reduced || (!walking && !idle)
            ? 0
            : doorClear * smooth(9.4, 9.8, age));
    const microWeight = Math.min(1, micro),
      breath = Math.sin(
        seconds * ((Math.PI * 2) / (7.2 + this.index * 0.35)) +
          this.index * 1.71,
      );
    this.body.scale.multiplyScalar(1 + 0.0022 * breath * microWeight);
    // A small hip settling gives the two-link legs enough reach for a planted sole.
    this.body.position.y -= 0.035 * walkBlend;
    const anticipate =
      walking && age > 5.9 && age < 6.4
        ? 0.014 * Math.sin(((age - 5.9) / 0.5) * Math.PI) ** 2
        : 0;
    this.body.position.y -= anticipate * walkBlend;
    const headYaw =
        0.035 * Math.sin(seconds * 0.24 + this.index * 1.67) * microWeight,
      headPitch =
        0.017 * Math.sin(seconds * 0.43 + this.index * 0.91) * microWeight;
    this.q[3].setFromAxisAngle(this.v[10].set(1, 0, 0), headPitch);
    this.q[4].setFromAxisAngle(this.v[11].set(0, 0, 1), headYaw);
    this.head.quaternion.multiply(this.q[3]).multiply(this.q[4]);
    this.diagnostics.headYaw = headYaw;
    this.ears.forEach((ear, i) => {
      const period = 14 + this.index * 1.7 + i * 2.1,
        t =
          (((seconds + this.index * 4.9 + i * 6.7) % period) + period) % period,
        u = clamp(t / 0.85),
        pulse =
          t < 0.85 ? Math.sin(Math.PI * u) ** 2 * Math.sin(Math.PI * 2 * u) : 0,
        angle = 0.055 * pulse * microWeight * (i === 0 ? 1 : -1);
      ear.quaternion.setFromAxisAngle(this.v[11].set(0, 1, 0), angle);
      if (i === 0) this.diagnostics.earL = angle;
      else this.diagnostics.earR = angle;
    });
    root.updateMatrixWorld(true);
    if (!walking && !idle) return;
    const path = this.paths[age < 6.4 ? 0 : 1],
      gait = walking ? a.walkDistance(age) / STRIDE : 0;
    for (let i = 0; i < this.legs.length; i++) {
      const { upper, lower, calibration: c } = this.legs[i],
        foot = this.v[12].copy(c.local).applyMatrix4(lower.matrixWorld),
        target = this.v[13].copy(foot),
        pinned = this.v[14];
      let stance = 0;
      if (walking) {
        const delta = wrap(pose.clipTime - c.centre);
        stance = 1 - smooth(0.12, 0.19, Math.abs(delta));
        const centreGait = gait - delta;
        path.sample(centreGait * STRIDE, this.anchor);
        const co = Math.cos(this.anchor.yaw),
          si = Math.sin(this.anchor.yaw);
        pinned.set(
          this.anchor.x + co * c.offset.x + si * c.offset.z,
          0,
          this.anchor.z - si * c.offset.x + co * c.offset.z,
        );
        pinned.y = a.groundHeight(pinned.x, pinned.z) + 0.004;
        target.lerp(pinned, stance);
        const swing = 0.055 * smooth(0.19, 0.38, Math.abs(delta));
        target.y = Math.max(
          target.y,
          a.groundHeight(target.x, target.z) + 0.004 + swing * (1 - stance),
        );
        target.lerpVectors(foot, target, walkBlend);
      } else target.y = a.groundHeight(target.x, target.z) + 0.004;
      this.solve(upper, lower, c.local, target, c.pole);
      const solved = this.v[12].copy(c.local).applyMatrix4(lower.matrixWorld),
        d = this.diagnostics.feet[i];
      d.stance = stance * walkBlend;
      d.error = solved.distanceTo(target);
      d.groundError = solved.y - a.groundHeight(solved.x, solved.z);
    }
    root.traverse((o) => {
      if ((o as SkinnedMesh).isSkinnedMesh)
        (o as SkinnedMesh).skeleton.update();
    });
  }
}
export function prepareControllers(actors: Actor[], a: Adapters) {
  const calibration = calibrate(actors[0], a),
    paths = [new ArcTable(0.8, 6.4, a), new ArcTable(9.3, 16.2, a)],
    controllers = actors.map(
      (actor, i) => new NaturalSheep(actor, i, a, calibration, paths),
    );
  controllers.forEach((c) => {
    c.actor.poseLayer = c;
  });
  return {
    calibration,
    controllers,
  };
}
export function contactExposure(x: number, z: number, barns: Barn[]) {
  let distance = Infinity;
  for (const b of barns) {
    const dx = x - b.x,
      dz = z - b.z,
      c = Math.cos(b.yaw),
      s = Math.sin(b.yaw);
    distance = Math.min(
      distance,
      Math.max(
        Math.abs(c * dx - s * dz) - 2.1,
        Math.abs(s * dx + c * dz) - 2.4,
      ),
    );
  }
  return smooth(-0.12, 0.7, distance);
}
export function createNaturalMotion(actors: Actor[], adapters: Adapters) {
  const { controllers, calibration } = prepareControllers(actors, adapters);
  const diagnostics = {
    world: undefined as unknown,
    adapters,
    controllers,
    calibration,
    phase: 4.4,
    activeSeconds: 0,
    reduced: false,
  };
  return {
    update(phase: number, seconds: number | undefined, reduced: boolean) {
      const active = seconds ?? diagnostics.activeSeconds;
      controllers.forEach((c) => c.update(phase, active, reduced));
      diagnostics.phase = phase;
      diagnostics.activeSeconds = active;
      diagnostics.reduced = reduced;
    },
    publish(world: unknown) {
      diagnostics.world = world;
      if (
        typeof location !== "undefined" &&
        new URLSearchParams(location.search).has("qa")
      )
        (
          globalThis as unknown as {
            __emQA: unknown;
          }
        ).__emQA = diagnostics;
    },
  };
}
