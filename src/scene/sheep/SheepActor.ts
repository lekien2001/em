import {
  AnimationMixer,
  Box3,
  LoopOnce,
  Mesh,
  SkinnedMesh,
  Vector3,
  type AnimationAction,
  type Material,
  type Object3D,
} from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import { release } from "../../assets/dispose";
import type { State } from "./natural";
export class SheepActor {
  readonly root: Object3D;
  readonly mixer: AnimationMixer;
  readonly actions: Record<State, AnimationAction>;
  private blendElapsed = 0.2;
  private blendFrom?: State;
  active: State = "Idle";
  private materials: Material[] = [];
  poseLayer?: {
    restoreBase(): void;
    captureBase(): void;
  };
  constructor(model: GLTF) {
    this.root = cloneSkeleton(model.scene);
    for (const [name, side] of [["EarL", 1], ["EarR", -1]] as const) {
      // Turn the wide original ears forward and down along the cheeks.
      const ear = this.root.getObjectByName(name);
      ear?.rotateZ(side * .48);
      ear?.rotateY(side * .78);
    }
    this.mixer = new AnimationMixer(this.root);
    const copies = new Map<Material, Material>();
    this.root.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      node.castShadow = node.receiveShadow = true;
      const copy = (material: Material) => {
        let owned = copies.get(material);
        if (!owned) {
          owned = material.clone();
          owned.transparent = false;
          owned.opacity = 1;
          owned.depthWrite = true;
          copies.set(material, owned);
          this.materials.push(owned);
        }
        return owned;
      };
      node.material = Array.isArray(node.material)
        ? node.material.map(copy)
        : copy(node.material);
    });
    const action = (state: State) => {
      const clip = model.animations.find((clip) => clip.name === state);
      if (!clip) throw new Error(`Missing sheep animation: ${state}`);
      const result = this.mixer.clipAction(clip);
      result.setEffectiveWeight(0).play();
      if (state === "Jump" || state === "Land") {
        result.setLoop(LoopOnce, 1);
        result.clampWhenFinished = true;
      }
      return result;
    };
    this.actions = {
      Idle: action("Idle"),
      Walk: action("Walk"),
      Jump: action("Jump"),
      Land: action("Land"),
    };
    this.actions.Idle.setEffectiveWeight(1);
    this.root.userData.shadowBounds = new Box3(
      new Vector3(-1.1, -0.12, -1.5),
      new Vector3(1.1, 2.45, 1.5),
    );
    this.mixer.update(0);
  }
  pose(
    state: State,
    clipTime: number,
    delta: number,
    rate: number,
    visible: boolean,
  ) {
    this.poseLayer?.restoreBase();
    const elapsed = delta / Math.max(rate, 0.001);
    if (state !== this.active) {
      this.blendFrom = this.active;
      this.actions[state].reset().play();
      this.blendElapsed = 0;
      this.active = state;
    }
    this.blendElapsed = Math.min(0.2, this.blendElapsed + elapsed);
    const phase = this.blendElapsed / 0.2,
      blend = phase * phase * (3 - 2 * phase);
    for (const [name, action] of Object.entries(this.actions))
      action.setEffectiveWeight(
        name === state
          ? this.blendFrom
            ? blend
            : 1
          : name === this.blendFrom
            ? 1 - blend
            : 0,
      );
    this.mixer.update(delta);
    const action = this.actions[state];
    action.time = Math.min(clipTime, action.getClip().duration);
    action.enabled = true;
    action.paused = false;
    this.mixer.update(0);
    if (this.blendElapsed >= 0.2) this.blendFrom = undefined;
    this.root.visible = visible;
    this.poseLayer?.captureBase();
  }
  reset() {
    this.poseLayer?.restoreBase();
    this.mixer.stopAllAction();
    Object.values(this.actions).forEach((action) =>
      action.reset().setEffectiveWeight(0).play(),
    );
    this.active = "Idle";
    this.blendFrom = undefined;
    this.blendElapsed = 0.2;
    this.actions.Idle.setEffectiveWeight(1);
    this.mixer.update(0);
    this.poseLayer?.captureBase();
  }
  dispose() {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.root);
    this.materials.forEach(release);
    this.root.traverse((node) => {
      if (node instanceof SkinnedMesh) release(node.skeleton);
    });
    this.poseLayer = undefined;
  }
}
