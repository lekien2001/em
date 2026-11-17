import fs from 'node:fs/promises';
import {parse} from '@babel/parser';
import traverseModule from '@babel/traverse';
import generatorModule from '@babel/generator';
import * as t from '@babel/types';
const traverse=traverseModule.default,generate=generatorModule.default;
const ast=parse(await fs.readFile('recovered/readable-bundle.js','utf8'));
let rootPath;traverse(ast,{ArrowFunctionExpression(p){if(p.parentPath.isCallExpression()&&p.parentPath.parentPath.parentPath.isProgram())rootPath=p;}});
if(!rootPath)throw new Error('Verified original wrapper missing');
const names={EM:'OriginalCatmullRomCurve3',mv:'SceneClock',xv:'SheepActor',Ek:'createWorld',Hh:'sheepPose',XJ:'crossingCount',SG:'sheepAge',qh:'barnDoors',hG:'barnLocal',Oh:'barnPoint',NQ:'barnDistance',cG:'inBarn',jG:'clearBarnPlant',Xh:'initTimeline',ZG:'initActor',ug:'initTerrain',ek:'initWorld',Ik:'initBarns',Ns:'initBarnLayout',Cs:'sourceAssets',gc:'MAIN_CAMERA',hD:'CAMERA_LIMITS',gk:'initCamera'};
for(const [a,b]of Object.entries(names)){if(!rootPath.scope.hasOwnBinding(a))throw new Error('Missing source symbol '+a);rootPath.scope.rename(a,b);}
const expression=s=>parse(s,{sourceType:'module'}).program.body[0].expression;
const statements=s=>parse(s,{sourceType:'module',allowReturnOutsideFunction:true}).program.body;
const stats={knoll:0,pad:0,clock:0,world:0,activeTime:0,contact:0,boxes:0,ceiling:0,rig:0};
traverse(ast,{
 VariableDeclarator(p){
  if(p.node.id.name==='Q'&&p.findParent(q=>q.isFunctionDeclaration()&&q.node.id.name==='rawMeadowHeight')){p.node.init=t.numericLiteral(0);stats.knoll++;}
  if(p.node.id.name==='E'&&p.findParent(q=>q.isFunctionDeclaration()&&q.node.id.name==='buildBarnGeometry')&&t.isArrowFunctionExpression(p.node.init)){
   p.node.init=expression('(w,h,d,r=.065)=>new Sv(w,h,d,h===.2&&d>5?2:1,r)');stats.boxes++;
  }
 },
 ObjectProperty(p){if(p.node.key.name==='height'&&t.isCallExpression(p.node.value)&&p.node.value.callee.name==='rawMeadowHeight'){
  const b=p.node.value.arguments[0].object;p.node.value=expression(`${b.name}.id==='exit'?rawMeadowHeight(0,0):rawMeadowHeight(${b.name}.x,${b.name}.z)`);stats.pad++;
 }},
 Class(p){if(!t.isAssignmentExpression(p.parent)||p.parent.left.name!=='SceneClock')return;
  p.node.body.body.unshift(t.classProperty(t.identifier('activeSeconds'),t.numericLiteral(0)));
  for(const m of p.node.body.body){if(!t.isClassMethod(m))continue;
   if(m.key.name==='sample'){m.body=t.blockStatement(statements(`if(this.running){const dt=Math.max(0,A-this.anchor)/1000;this.phase+=dt*this.rate;this.activeSeconds+=dt;}this.anchor=A;const count=crossingCount(this.phase),crossings=count-this.reported;this.reported=count;return {phase:this.phase,crossings,activeSeconds:this.activeSeconds};`));stats.clock++;}
   if(m.key.name==='reset')m.body.body.push(...statements('this.activeSeconds=0;'));
  }
 },
 CallExpression(p){
  if(t.isMemberExpression(p.node.callee)&&p.node.callee.property.name==='update'&&p.node.arguments.length===3&&t.isMemberExpression(p.node.arguments[0])&&p.node.arguments[0].property.name==='phase'){
   p.node.arguments.push(t.memberExpression(t.cloneNode(p.node.arguments[0].object),t.identifier('activeSeconds')));stats.activeTime++;
  }
  if(p.node.callee.name==='Sv')return;
  if(t.isMemberExpression(p.node.callee)&&p.node.callee.property.name==='setX'&&p.node.arguments.length===2&&p.findParent(q=>q.isFunctionDeclaration()&&q.node.id.name==='createWorld')){
   const old=p.node.arguments[1];if(t.isConditionalExpression(old)&&generate(old).code.includes('inBarn')){p.node.arguments[1]=expression('DA.root.visible?.8*EM.contactExposure(IA.x,IA.z,BARNS)*Math.exp(-G*.8):0');stats.contact++;}
  }
 },
 ReturnStatement(p){
  if(p.getFunctionParent()?.node.id?.name==='buildBarnGeometry'&&t.isObjectExpression(p.node.argument)){p.insertBefore(statements('I(P,E(BARN_WIDTH,.10,BARN_DEPTH),0,2.73,0);'));stats.ceiling++;}
  if(!p.findParent(q=>q.isFunctionDeclaration()&&q.node.id.name==='createWorld')||!t.isObjectExpression(p.node.argument))return;
  if(!p.node.argument.properties.some(v=>v.key?.name==='barnTriangles'))return;
  p.node.argument=t.callExpression(t.memberExpression(t.identifier('EM'),t.identifier('decorateWorld')),[p.node.argument,expression('({groundHeight,meadowHeight,getPose:sheepPose,getAge:sheepAge,barns:BARNS,walkDistance:(age)=>age<6.4?xG.sample(age).distance:age<13.7?kG.sample(age).distance:kG.length+_J.sample(age).distance,Vector3:F,Quaternion:(new qP()).quaternion.constructor})')]);stats.world++;
 },
 StringLiteral(p){if(p.node.value==='/assets/a91596e96e28ba3c.glb'){p.node.value='/assets/sheep-natural.glb';stats.rig++;}},
 NumericLiteral(p){if(!p.findParent(q=>q.isFunctionDeclaration()&&q.node.id.name==='buildBarnGeometry'))return;
  if(p.node.value===.075)p.node.value=.11;else if(p.node.value===.055)p.node.value=.08;
 }
});
for(const [key,count]of Object.entries(stats))if(count!==1)throw new Error('Unsafe patch cardinality '+key+': '+count);
const body=rootPath.node.body;
const rootRender=body.body.findIndex(n=>t.isExpressionStatement(n)&&generate(n).code.includes('Ck.createRoot'));
if(rootRender<0)throw new Error('Original React root render not found');
body.body.splice(rootRender,0,...statements(`if(EM.testMode){initWorld();initTimeline();initCamera();zG();EM.testApi={SceneClock,SheepActor,sheepPose,sheepAge,barnDoors,crossingCount,groundHeight,meadowHeight,rawMeadowHeight,barnPoint,barnLocal,barnDistance,BARNS,JUMP_YAW,MAIN_CAMERA,CAMERA_LIMITS,Quaternion:(new qP()).quaternion.constructor,walkDistance:(age)=>age<6.4?xG.sample(age).distance:age<13.7?kG.sample(age).distance:kG.length+_J.sample(age).distance,buildBarnGeometry,createBarns:ik,GLTFLoader:lv,Texture:go,Vector3:F,Box3:wi,Group:qP,Mesh:tP,SkinnedMesh:ke,disposeObject:rD,sourceAssets,createWorld};return EM.testApi;}`));
// go is replaced below with the actual Texture base-class binding, found by flag.
let textureName;
traverse(ast,{AssignmentExpression(p){if(t.isMemberExpression(p.node.left)&&p.node.left.property.name==='isTexture'&&t.isThisExpression(p.node.left.object)){const c=p.findParent(q=>q.isClass());if(c?.parentPath.isAssignmentExpression())textureName=c.parentPath.node.left.name;}}});
if(!textureName)throw new Error('Texture class binding not found');
traverse(ast,{ObjectProperty(p){if(p.node.key.name==='Texture'&&p.node.value.name==='go')p.node.value=t.identifier(textureName);}});
const fn=t.exportDefaultDeclaration(t.functionDeclaration(t.identifier('boot'),[t.identifier('EM')],body));
const output=t.file(t.program([fn]));output.comments=ast.comments;
await fs.writeFile('src/recovered-runtime.js',generate(output,{comments:true}).code);
await fs.writeFile('recovered/patch-report.json',JSON.stringify({stats,textureName,notes:'Original React/Three runtime retained; AST-verified integration seams only. No eval or runtime text patching.'},null,2));
console.log('Runtime recovery patches verified:',stats);
