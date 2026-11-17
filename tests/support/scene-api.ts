// Typed modules are imported directly; no runtime boot or injected test mode.
import {Quaternion,Texture,Vector3,Box3,Group,Mesh,SkinnedMesh} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {SceneClock,sheepPose,sheepAge,barnDoors,crossingCount,APPROACH_PATH,RETURN_PATH,ENTRANCE_PATH} from '../../src/scene/sheep/timeline';
import {SheepActor} from '../../src/scene/sheep/SheepActor';
import {groundHeight,meadowHeight,rawMeadowHeight} from '../../src/scene/terrain';
import {barnPoint,barnLocal,barnDistance,BARNS,JUMP_YAW} from '../../src/scene/barnLayout';
import {MAIN_CAMERA,CAMERA_LIMITS} from '../../src/scene/camera';
import {buildBarnGeometry,createBarns} from '../../src/scene/barns';
import {createWorld} from '../../src/scene/world';
import {disposeObject} from '../../src/assets/dispose';
import {sourceAssets} from '../../src/assets/catalog';
export const api={SceneClock,SheepActor,sheepPose,sheepAge,barnDoors,crossingCount,groundHeight,meadowHeight,rawMeadowHeight,barnPoint,barnLocal,barnDistance,BARNS,JUMP_YAW,MAIN_CAMERA,CAMERA_LIMITS,Quaternion,Texture,Vector3,Box3,Group,Mesh,SkinnedMesh,GLTFLoader,sourceAssets,createWorld,buildBarnGeometry,createBarns,disposeObject,walkDistance:(age:number)=>age<6.4?APPROACH_PATH.sample(age).distance:age<13.7?RETURN_PATH.sample(age).distance:RETURN_PATH.length+ENTRANCE_PATH.sample(age).distance};
