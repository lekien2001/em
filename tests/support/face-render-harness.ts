import { ACESFilmicToneMapping, AmbientLight, DirectionalLight, HemisphereLight, Mesh, PerspectiveCamera, Scene, SRGBColorSpace, WebGLRenderer } from "three";
import { AssetLoader } from "../../src/assets/AssetLoader";
import { disposeObject } from "../../src/assets/dispose";
import { FaceAttachment } from "../../src/face/FaceAttachment";
import { exportFace, initialCrop } from "../../src/face/image";
import { SHEEP_FACE_STYLES } from "../../src/face/sheepPresets";
import { SheepActor } from "../../src/scene/sheep/SheepActor";
const renderer = new WebGLRenderer({
  antialias: true,
  preserveDrawingBuffer: true
});
renderer.setSize(320, 400);
renderer.outputColorSpace = SRGBColorSpace;
renderer.toneMapping = ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);
const scene = new Scene(),
  camera = new PerspectiveCamera(32, .8, .05, 30),
  assets = new AssetLoader();
scene.add(new HemisphereLight(0xafc2d8, 0x54787b, 2.3), new AmbientLight(0xc3e3df, .85));
const light = new DirectionalLight(0xffedcf, 2);
light.position.set(-3, 5, 5);
scene.add(light);
const model = await assets.model("sheep-model"),
  actor = new SheepActor(model);
scene.add(actor.root);
let dfg: { value: any } | undefined;
actor.root.traverse(node => { if (node instanceof Mesh && !Array.isArray(node.material)) node.material.onBeforeCompile = shader => { dfg ??= shader.uniforms.dfgLUT; }; });
const resources = new Map<object, number>();
const watch = (object: any) => {
  if (!resources.has(object)) {
    resources.set(object, 0);
    object.addEventListener("dispose", () => resources.set(object, resources.get(object)! + 1));
  }
};
const face = new FaceAttachment([actor.root], [SHEEP_FACE_STYLES[0]]);
const view = (angle = 0) => {
  camera.position.set(Math.sin(angle) * 3.2, 1.55, .81 + Math.cos(angle) * 3.2);
  camera.lookAt(0, 1.47, .81);
  renderer.render(scene, camera);
};
view();
const api = {
  baseline: {
    ...renderer.info.memory
  },
  apply() {
    const source = document.createElement("canvas");
    source.width = 768;
    source.height = 1024;
    const context = source.getContext("2d")!;
    context.fillStyle = "#e53b9a";
    context.fillRect(0, 0, 768, 1024);
    const output = exportFace(source, initialCrop());
    face.set({
      canvas: output,
      revision: 0
    });
    actor.root.getObjectByName("Personal face")!.traverse(node => {
      if (node instanceof Mesh && !Array.isArray(node.material)) {
        watch(node.geometry);
        watch(node.material);
        if ("map" in node.material && node.material.map) watch(node.material.map);
      }
    });
    view();
    return {
      ...renderer.info.memory
    };
  },
  restore() {
    face.set(null);
    view();
    return {
      ...renderer.info.memory
    };
  },
  pose(state: "Idle" | "Walk" | "Jump" | "Land", time: number) {
    actor.pose(state, time, .21, 1, true);
    view();
  },
  view(angle: number) {
    view(angle);
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 400;
    const context = canvas.getContext("2d")!;
    context.drawImage(renderer.domElement, 0, 0);
    const data = context.getImageData(0, 0, 320, 400).data;
    let photoPixels = 0;
    for (let i = 0; i < data.length; i += 4) if (Math.abs(data[i] - 229) < 3 && Math.abs(data[i + 1] - 59) < 3 && Math.abs(data[i + 2] - 154) < 3) photoPixels++;
    return {
      photoPixels,
      center: Array.from(context.getImageData(160, 200, 1, 1).data)
    };
  },
  dispose() {
    face.dispose();
    actor.dispose();
    disposeObject(scene);
    assets.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
    return {
      // Three.js 0.181 keeps a shared 32x32 DFG lighting LUT outside scene
      // ownership. Do not dispose it while another renderer may still use it.
      rendererCacheTextures: dfg?.value?.image?.width === 32 && dfg?.value?.image?.height === 32 ? 1 : 0,
      contextLost: renderer.getContext().isContextLost(),
      memory: {
        ...renderer.info.memory
      },
      repeatedDisposals: [...resources.values()].filter(count => count > 1).length
    };
  }
};
Object.assign(window, {
  __faceRender: api
});
