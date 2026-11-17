// One-time annotations for faithfully extracted algorithms; normal builds use TS.
import fs from'node:fs/promises';import{parse}from'@babel/parser';import tr from'@babel/traverse';import gen from'@babel/generator';import*as t from'@babel/types';const traverse=tr.default,generate=gen.default;
const ann=s=>parse(`let value:${s}`,{sourceType:'module',plugins:['typescript']}).program.body[0].declarations[0].id.typeAnnotation;
const num=(...names)=>Object.fromEntries(names.map(n=>[n,[]]));
const specs={
 'scene/barnLayout':{barnLocal:['Barn','number','number'],barnPoint:['Barn','number','number'],barnDistance:['Barn','number','number'],inBarn:['number','number','number'],clearBarnPlant:['Point2']},
 'scene/sheep/timeline':{...num('crossingCount','hermite','hermiteDerivative','sheepAge','barnDoors','sheepPose','clamp01','ease'),createArcPath:['number','number','Point2','Point2','Point2','Point2'],constructor:['number'],sample:['number'],configure:['number','boolean','number'],reset:['number']},
 'scene/terrain':num('smoothRange','creekCenter','creekWidth','rawMeadowHeight','meadowHeight','groundHeight','minimumCameraHeight','terrainClamp'),
 'scene/sky':{createSky:['Texture','Texture','()=>number'],update:['PerspectiveCamera','number']},
 'scene/vegetation/layout':{...num('cellRandom','segmentDistance','sheepPathDistance','grassCells')},
 'scene/vegetation/detail':{selectDetail:['number','number|undefined','number[]','number'],constructor:['Object3D[]','Vector3','number','number[]'],update:['PerspectiveCamera','number']},
 'scene/vegetation/grass':{...num('coverNoise','coverTone','createGrassGeometry','fract'),applyGroundCover:['MeshStandardMaterial','{value:Vector3}'],createGrass:['Object3D','MeshStandardMaterial','{value:number}','{value:Vector3}'],update:['PerspectiveCamera','number'],quality:['Quality']},
 'scene/vegetation/plants':{createVegetation:['Object3D','AssetLoader','{value:number}'],update:['PerspectiveCamera','number']},
 'scene/barns':{createBarns:['Object3D','AssetLoader'],update:['number']},
 'scene/world':{seededRandom:['number'],createWorld:['Object3D','AssetLoader'],resize:['number','number'],update:['number','boolean','PerspectiveCamera'],quality:['Quality'],walkDistance:['number']},
 'scene/shadows':{cacheStaticShadows:['WebGLRenderer','Scene','DirectionalLight','PerspectiveCamera','Object3D[]']},
 'scene/quality':{constructor:['boolean'],observe:['number','number']},
 'scene/FrameMonitor':{record:['string','number','number','number','number']},
 'ui/useImmersiveControls':{useImmersiveControls:['ImmersionState']},
 'scene/SceneView':{SceneView:['SceneProps']},
};
const extras={
 'scene/barnLayout':`export type Point2={x:number;z:number};export type Barn=Point2&{id:'entry'|'exit';yaw:number};`,
 'scene/sheep/timeline':`import type {Point2} from '../barnLayout';import type {Pose} from '../../enhancements';`,
};
for(const [mod,functions]of Object.entries(specs)){
 const filename='src/'+mod+(mod==='scene/SceneView'?'.tsx':'.ts');let s=await fs.readFile(filename,'utf8');
 s=`import type {Texture,PerspectiveCamera,Object3D,Vector3,MeshStandardMaterial,WebGLRenderer,Scene,DirectionalLight} from 'three';\nimport type {Quality,ImmersionState,SceneProps,FrameSample} from '${mod.startsWith('scene/vegetation/')||mod.startsWith('scene/sheep/')?'../../types':'../types'}';\n`+(!s.includes('import { AssetLoader }')?`import type {AssetLoader} from '${mod.startsWith('scene/vegetation/')||mod.startsWith('scene/sheep/')?'../../assets/AssetLoader':'../assets/AssetLoader'}';\n`:'')+(extras[mod]||'')+'\n'+s;
 // Avoid duplicate type/value imports: value imports provide the type too.
 for(const name of ['Texture','PerspectiveCamera','Object3D','Vector3','MeshStandardMaterial','WebGLRenderer','Scene','DirectionalLight'])if(new RegExp('import \\{[^}]*\\b'+name+'\\b[^}]*\\} from').test(s))s=s.replace(new RegExp('(?<=import type \\{[^}]{0,300})\\b'+name+',?'),'');
 const a=parse(s,{sourceType:'module',plugins:['typescript','jsx']});
 traverse(a,{Function(p){const name=p.node.id?.name||p.node.key?.name||(p.parentPath.isVariableDeclarator()?p.parent.id.name:undefined),types=functions[name];if(!types)return;
  p.node.params.forEach((param,i)=>{const target=t.isAssignmentPattern(param)?param.left:param;if(t.isIdentifier(target)&&!target.typeAnnotation)target.typeAnnotation=ann(types[i]||'number');});
  if(name==='sheepPose')p.node.returnType=ann('Pose');
 },VariableDeclarator(p){const n=p.node.id.name,types={BARNS:'Barn[]',QUALITY_LEVELS:'Quality[]'};if(types[n])p.node.id.typeAnnotation=ann(types[n]);},ClassProperty(p){const name=p.node.key.name;let type;
  if(mod==='scene/FrameMonitor')type={samples:'FrameSample[]',previous:'{mode:string;at:number}|undefined'}[name];
  if(mod==='scene/quality')type={mobile:'boolean',value:'Quality'}[name];
  if(mod==='scene/vegetation/detail')type={levels:'Object3D[]',center:'Vector3',size:'number',thresholds:'number[]',current:'number|undefined'}[name];
  if(type)p.node.typeAnnotation=ann(type);
 }});await fs.writeFile(filename,generate(a,{jsescOption:{minimal:true}}).code+'\n');
}
