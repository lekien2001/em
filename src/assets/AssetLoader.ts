import {
  NoColorSpace,
  SRGBColorSpace,
  TextureLoader,
  type Texture,
} from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { sourceAssets } from "./catalog";
import { disposeObject, release } from "./dispose";
export type AssetId = keyof typeof sourceAssets;
export class AssetLoader {
  private textures = new Map<string, Promise<Texture>>();
  private models = new Map<string, Promise<GLTF>>();
  private disposed = false;
  texture(id: AssetId, color = true): Promise<Texture> {
    const url = sourceAssets[id].url;
    let loaded = this.textures.get(url);
    if (!loaded) {
      loaded = new TextureLoader().loadAsync(url).then((texture) => {
        texture.colorSpace = color ? SRGBColorSpace : NoColorSpace;
        texture.anisotropy = 4;
        if (this.disposed) release(texture);
        return texture;
      });
      this.textures.set(url, loaded);
    }
    return loaded;
  }
  model(id: AssetId): Promise<GLTF> {
    const url = sourceAssets[id].url;
    let loaded = this.models.get(url);
    if (!loaded) {
      loaded = new GLTFLoader().loadAsync(url).then((model) => {
        if (this.disposed) disposeObject(model.scene);
        return model;
      });
      this.models.set(url, loaded);
    }
    return loaded;
  }
  dispose() {
    this.disposed = true;
    this.textures.forEach((p) => {
      void p.then(
        (texture) => release(texture),
        () => {},
      );
    });
    this.models.forEach((p) => {
      void p.then(
        (model) => disposeObject(model.scene),
        () => {},
      );
    });
    this.textures.clear();
    this.models.clear();
  }
}
