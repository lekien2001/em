// One-time, source-preserving migration. Not part of the application/build.
import fs from 'node:fs/promises';
import path from 'node:path';
import {parse} from '@babel/parser';
import traverseModule from '@babel/traverse';
import generatorModule from '@babel/generator';
import * as t from '@babel/types';
const traverse=traverseModule.default,generate=generatorModule.default;
const ast=parse(await fs.readFile('recovered/reference-runtime.js','utf8'),{sourceType:'module'});
let root;traverse(ast,{FunctionDeclaration(p){if(p.node.id?.name==='boot')root=p;}});
const vendor={Ge:'Sprite',tP:'Mesh',aE:'Points',ke:'SkinnedMesh',wI:'InstancedMesh',Ei:'Texture',us:'TextureLoader',pP:'SRGBColorSpace',hE:'NoColorSpace',lv:'GLTFLoader',ED:'AnimationMixer',Cv:'LoopOnce',wi:'Box3',F:'Vector3',xs:'CanvasTexture',qP:'Group',me:'SphereGeometry',QI:'ShaderMaterial',Si:'BackSide',lA:'Color',Rg:'SpriteMaterial',gD:'AdditiveBlending',UP:'BufferGeometry',BP:'Float32BufferAttribute',OE:'PointsMaterial',UI:'MathUtils',Vs:'mergeGeometries',Us:'MeshLambertMaterial',DI:'DoubleSide',aP:'Object3D',ii:'Quaternion',Xi:'InstancedBufferAttribute',Ui:'MeshPhysicalMaterial',WA:'Matrix4',Sv:'RoundedBoxGeometry',JQ:'Shape',qt:'ExtrudeGeometry',Fi:'MeshStandardMaterial',sA:'Vector2',KE:'RepeatWrapping',WE:'PlaneGeometry',YI:'MeshBasicMaterial',DP:'Vector4',AP:'ShaderChunk',zv:'WebGLRenderer',kM:'ACESFilmicToneMapping',nM:'PCFShadowMap',ut:'Scene',St:'Fog',_t:'HemisphereLight',Ue:'DirectionalLight',iD:'AmbientLight',Qi:'PerspectiveCamera',Tv:'OrbitControls',kg:'Spherical',JG:'cloneSkeleton'};
const rename={...vendor,rD:'disposeObject',Gv:'AssetLoader',Sg:'hermite',lG:'hermiteDerivative',Nh:'createArcPath',kv:'SHEEP_CYCLE',TG:'INITIAL_PHASE',mG:'clamp01',qs:'ease',Wh:'ENTRY_BARN',Hs:'EXIT_BARN',YG:'ZERO_VELOCITY',xG:'APPROACH_PATH',RG:'INITIAL_TANGENT',GG:'ENTRY_YAW',FG:'EXIT_APPROACH',UG:'EXIT_TANGENT',kG:'RETURN_PATH',_J:'ENTRANCE_PATH',_h:'QUALITY_LEVELS',Yv:'QualityController',di:'smoothRange',cE:'creekCenter',SI:'creekWidth',KG:'minimumCameraHeight',yG:'TERRAIN_RADIUS',pG:'FOG_NEAR',fG:'FOG_FAR',$J:'terrainClamp',AL:'BARN_PADS',PL:'createMoonGlow',OG:'createSky',VG:'MOON_DIRECTION',jE:'cellRandom',Ac:'segmentDistance',NG:'sheepPathDistance',qG:'grassCells',HG:'flowerPlacements',Pc:'TREE_CENTERS',Fv:'TREE_PLACEMENTS',Uv:'GRASS_BANDS',iL:'FLOWER_PATCHES',IL:'selectDetail',Xs:'ScreenDetail',Ec:'coverNoise',gL:'coverTone',ec:'applyGroundCover',sL:'createGrassGeometry',XG:'createGrass',EL:'COVER_NOISE_GLSL',eL:'COVER_COLOR_GLSL',nD:'fract',$G:'createVegetation',ik:'createBarns',QL:'seededRandom',wL:'createContactTexture',tL:'createTerrainGeometry',sk:'cacheStaticShadows',uv:'FrameMonitor',wk:'SceneView',fE:'sounds',CC:'AudioEngine',pR:'readPreference',fR:'writePreference',dR:'useRelaxationSession',VR:'useImmersiveControls',KR:'DESKTOP_POINTER',cD:'Dialog',sc:'App',_o:'ArrowUpRight',Pt:'Eye',At:'EyeOff',PQ:'Sparkles',iQ:'Moon',st:'CloseIcon'};
for(const [a,b]of Object.entries(rename))if(root.scope.hasOwnBinding(a))root.scope.rename(a,b);
const reactNames=['HP','WP','OI','IE','Bk'];
for(const n of reactNames){const b=root.scope.getBinding(n);for(const p of b?.referencePaths||[])p.replaceWith(t.identifier('React'));}
const wrappers=new Set(Object.entries(root.scope.bindings).filter(([,b])=>b.path.isVariableDeclarator()&&t.isCallExpression(b.path.node.init)&&b.path.node.init.callee.name==='yP').map(([n])=>n));
const modules=new Map();
const moduleFor=(n,line)=>{
 if(n==='sourceAssets'||n==='BC')return 'assets/catalog';
 if(line>=31275&&line<31317)return 'assets/AssetLoader';
 if(line>=31317&&line<31375)return 'scene/barnLayout';
 if(line>=31375&&line<31579)return 'scene/sheep/timeline';
 if(line>=31579&&line<31607)return 'scene/quality';
 if(line>=31628&&line<31688)return 'scene/sheep/SheepActor';
 if(line>=31688&&line<31741)return 'scene/terrain';
 if(line>=31741&&line<31843)return 'scene/sky';
 if(line>=31843&&line<31992)return 'scene/vegetation/layout';
 if(line>=31992&&line<32028)return 'scene/vegetation/detail';
 if(line>=32028&&line<32223)return 'scene/vegetation/grass';
 if(line>=32223&&line<32312)return 'scene/vegetation/plants';
 if(line>=32373&&line<32508)return 'scene/barns';
 if(line>=32508&&line<32759)return 'scene/world';
 if(line>=32759&&line<32775)return 'scene/camera';
 if(line>=32775&&line<32836)return 'scene/shadows';
 if(line>=32836&&line<32872)return 'scene/FrameMonitor';
 if(line>=32876&&line<33102)return 'scene/SceneView';
 if(line>=33162&&line<33383)return 'ui/icons';
 if(n==='sounds')return 'audio/catalog';
 if(n==='AudioEngine')return 'audio/AudioEngine';
 if(line>=33477&&line<33489)return 'session/preferences';
 if(line>=33489&&line<33573)return 'session/useRelaxationSession';
 if(line>=33573&&line<33662)return 'ui/useImmersiveControls';
 if(line>=33664&&line<33717)return 'ui/Dialog';
 if(line>=33717&&line<34291)return 'app/App';
};
const push=(mod,node)=>{if(mod){if(!modules.has(mod))modules.set(mod,[]);modules.get(mod).push(node);}};
function flatten(mod,node){
 if(t.isExpressionStatement(node)&&t.isCallExpression(node.expression)&&wrappers.has(node.expression.callee.name))return;
 if(t.isExpressionStatement(node)&&t.isSequenceExpression(node.expression)){for(const e of node.expression.expressions)flatten(mod,t.expressionStatement(e));return;}
 if(t.isExpressionStatement(node)&&t.isAssignmentExpression(node.expression)&&t.isIdentifier(node.expression.left)){
  const e=node.expression;let value=e.right;
  if(t.isClassExpression(value)){value=t.classDeclaration(t.identifier(e.left.name),value.superClass,value.body);push(mod,value);}
  else push(mod,t.variableDeclaration('const',[t.variableDeclarator(e.left,value)]));return;
 }
 if(t.isVariableDeclaration(node)){for(const d of node.declarations){if(!d.init)continue;
  if(t.isCallExpression(d.init)&&d.init.callee.name==='yP'){for(const b of d.init.arguments[0].body.body)flatten(mod,b);}
  else push(mod,t.variableDeclaration('const',[d]));}return;
 }
 push(mod,node);
}
for(const node of root.node.body.body){
 if(t.isVariableDeclaration(node)){for(const d of node.declarations){const mod=moduleFor(d.id.name,node.loc.start.line);if(mod)flatten(mod,t.variableDeclaration(node.kind,[d]));}}
 else {const n=node.id?.name,mod=moduleFor(n,node.loc.start.line);if(mod)flatten(mod,node);}
}
// Strip only the bundled lazy init calls; regular application calls stay intact.
for(const nodes of modules.values()){
 const a=t.file(t.program(nodes));traverse(a,{CallExpression(p){if(wrappers.has(p.node.callee.name)&&p.node.arguments.length===0)p.replaceWith(t.unaryExpression('void',t.numericLiteral(0)));},SequenceExpression(p){if(p.node.expressions.length===2&&t.isNumericLiteral(p.node.expressions[0],{value:0}))p.replaceWith(p.node.expressions[1]);}});
}
// JSX syntax preserves the exact original props/children and keys.
const jsxName=n=>t.isStringLiteral(n)?t.jsxIdentifier(n.value):t.isMemberExpression(n)?t.jsxMemberExpression(jsxName(n.object),jsxName(n.property)):t.jsxIdentifier(n.name);
const child=n=>t.isJSXElement(n)||t.isJSXFragment(n)?n:t.jsxExpressionContainer(n);
for(const [mod,nodes]of modules){const a=t.file(t.program(nodes));traverse(a,{CallExpression:{exit(p){const c=p.node.callee;if(!t.isMemberExpression(c)||!['y','qQ'].includes(c.object.name)||!['jsx','jsxs'].includes(c.property.name))return;
 const [kind,props,key]=p.node.arguments,attrs=[],children=[];
 for(const prop of props.properties){if(t.isSpreadElement(prop)){attrs.push(t.jsxSpreadAttribute(prop.argument));continue;}const name=prop.key.name||prop.key.value;
 if(name==='children'){for(const v of t.isArrayExpression(prop.value)?prop.value.elements:[prop.value])if(v)children.push(child(v));}
 else attrs.push(t.jsxAttribute(t.jsxIdentifier(name),t.jsxExpressionContainer(prop.value)));}
 if(key)attrs.push(t.jsxAttribute(t.jsxIdentifier('key'),t.jsxExpressionContainer(key)));
 if(t.isMemberExpression(kind)&&kind.object.name==='y'&&kind.property.name==='Fragment')p.replaceWith(t.jsxFragment(t.jsxOpeningFragment(),t.jsxClosingFragment(),children));
 else{const name=jsxName(kind);p.replaceWith(t.jsxElement(t.jsxOpeningElement(name,attrs,children.length===0),children.length?t.jsxClosingElement(name):null,children));}
}}});}
const owner=new Map();for(const [mod,nodes]of modules){const a=t.file(t.program(nodes));traverse(a,{Program(p){for(const name of Object.keys(p.scope.bindings))owner.set(name,mod);}});}
const extras={GLTFLoader:['GLTFLoader','three/addons/loaders/GLTFLoader.js'],OrbitControls:['OrbitControls','three/addons/controls/OrbitControls.js'],RoundedBoxGeometry:['RoundedBoxGeometry','three/addons/geometries/RoundedBoxGeometry.js'],mergeGeometries:['mergeGeometries','three/addons/utils/BufferGeometryUtils.js'],cloneSkeleton:['clone','three/addons/utils/SkeletonUtils.js']};
for(const [mod,nodes]of modules){
 const a=t.file(t.program(nodes)),free=new Set();traverse(a,{ReferencedIdentifier(p){if(!p.scope.getBinding(p.node.name))free.add(p.node.name);},JSXIdentifier(p){const n=p.node.name;if(/^[A-Z]/.test(n)&&!p.scope.getBinding(n))free.add(n);}});
 const imports=new Map(),add=(from,name,local=name)=>{if(!imports.has(from))imports.set(from,[]);imports.get(from).push(t.importSpecifier(t.identifier(local),t.identifier(name)));};
 for(const name of free){if(name==='React'){a.program.body.unshift(t.importDeclaration([t.importNamespaceSpecifier(t.identifier('React'))],t.stringLiteral('react')));continue;}
  if(name==='_A'){add('../ui/iconFactory','createIcon','_A');continue;}
  const target=owner.get(name);if(target&&target!==mod){let rel=path.posix.relative(path.posix.dirname(mod),target);if(!rel.startsWith('.'))rel='./'+rel;add(rel,name);}
  else if(extras[name])add(extras[name][1],extras[name][0],name);
  else if(Object.values(vendor).includes(name))add('three',name);
  else if(name==='EM'){add('../enhancements','createEnhancements');}
  else if(name==='DL')add('../scene/SceneView','SceneView','DL');
  else if(!['Array','Math','Map','Set','Object','Promise','String','Number','NaN','Infinity','Error','Float32Array','Date','AudioContext','window','document','innerWidth','innerHeight','devicePixelRatio','performance','requestAnimationFrame','cancelAnimationFrame','ResizeObserver','console','setTimeout','clearTimeout','clearInterval','matchMedia','HTMLElement','localStorage','URLSearchParams','location'].includes(name))console.log('UNRESOLVED',mod,name);
 }
 const exports=nodes.map(n=>t.isFunctionDeclaration(n)||t.isClassDeclaration(n)||t.isVariableDeclaration(n)?t.exportNamedDeclaration(n):n);
 a.program.body=[...a.program.body.filter(n=>t.isImportDeclaration(n)),...Array.from(imports,([from,specifiers])=>t.importDeclaration(specifiers,t.stringLiteral(from))),...(free.has('EM')?[t.variableDeclaration('const',[t.variableDeclarator(t.identifier('EM'),t.callExpression(t.identifier('createEnhancements'),[]))])]:[]),...exports];
 const filename='src/'+mod+(['app/App','ui/Dialog','scene/SceneView'].includes(mod)?'.tsx':'.ts');await fs.mkdir(path.dirname(filename),{recursive:true});await fs.writeFile(filename,generate(a,{comments:true}).code+'\n');
 console.log(filename,owner.size,'bindings;',free.size,'imports/globals');
}
await fs.writeFile('recovered/module-migration.json',JSON.stringify({source:'reference-runtime.js',modules:[...modules.keys()],vendor},null,2));
