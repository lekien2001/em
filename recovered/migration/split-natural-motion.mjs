import fs from'node:fs/promises';import{parse}from'@babel/parser';import tr from'@babel/traverse';import gen from'@babel/generator';import*as t from'@babel/types';const parseTS=s=>parse(s,{sourceType:'module',plugins:['typescript','jsx']}),traverse=tr.default,generate=gen.default;
let s=await fs.readFile('src/enhancements.ts','utf8');let a=parseTS(s),harmonize=a.program.body.find(n=>t.isExportNamedDeclaration(n)&&n.declaration?.id?.name==='harmonize');await fs.writeFile('src/scene/materials.ts',`import type{Object3D,Mesh,Material}from'three';\n`+generate(harmonize).code+'\n');a.program.body=a.program.body.filter(n=>n!==harmonize&&!(t.isExportNamedDeclaration(n)&&n.declaration?.declarations?.[0]?.id.name==='worldMotion')&&!(t.isTSTypeAliasDeclaration(n)&&n.id.name==='World'));
s=generate(a,{jsescOption:{minimal:true}}).code;
s=s.replace('import type {','import { Quaternion, Vector3, type ');
// The source imports are formatted multiline; remove duplicate type symbols.
s=s.replace(/\n  Quaternion,/,'').replace(/\n  Vector3,/,'');
s=s.replace(/new a\.Vector3\(/g,'new Vector3(').replace(/new a\.Quaternion\(/g,'new Quaternion(').replace(/\n  Vector3: new[^;]+;\n  Quaternion: new[^;]+;/,'');
s+=`\nexport function contactExposure(x:number,z:number,barns:Barn[]){let distance=Infinity;for(const b of barns){const dx=x-b.x,dz=z-b.z,c=Math.cos(b.yaw),s=Math.sin(b.yaw);distance=Math.min(distance,Math.max(Math.abs(c*dx-s*dz)-2.1,Math.abs(s*dx+c*dz)-2.4));}return smooth(-.12,.7,distance);}
export function createNaturalMotion(actors:Actor[],adapters:Adapters){
 const {controllers,calibration}=prepareControllers(actors,adapters);
 const diagnostics={world:undefined as unknown,adapters,controllers,calibration,phase:4.4,activeSeconds:0,reduced:false};
 return {
  update(phase:number,seconds:number|undefined,reduced:boolean){const active=seconds??diagnostics.activeSeconds;controllers.forEach(c=>c.update(phase,active,reduced));diagnostics.phase=phase;diagnostics.activeSeconds=active;diagnostics.reduced=reduced;},
  publish(world:unknown){diagnostics.world=world;if(typeof location!=='undefined'&&new URLSearchParams(location.search).has('qa'))(globalThis as unknown as {__emQA:unknown}).__emQA=diagnostics;}
 };
}\n`;
await fs.mkdir('src/scene/sheep',{recursive:true});await fs.writeFile('src/scene/sheep/natural.ts',s);
// Dedicated typed pipeline instead of replacing world.update at runtime.
a=parseTS(await fs.readFile('src/scene/world.ts','utf8'));a.program.body=a.program.body.filter(n=>!(t.isImportDeclaration(n)&&n.source.value==='../enhancements'));
a.program.body.unshift(...parseTS(`import{harmonize}from'./materials';import{createNaturalMotion,contactExposure}from'./sheep/natural';`).program.body);
traverse(a,{CallExpression(p){if(p.node.callee.object?.name==='worldMotion'&&p.node.callee.property.name==='contactExposure')p.node.callee=t.identifier('contactExposure');},ReturnStatement(p){const call=p.node.argument;if(!t.isCallExpression(call)||call.callee.property?.name!=='attach')return;
 const [world,adapters]=call.arguments;adapters.properties=adapters.properties.filter(n=>!['Vector3','Quaternion'].includes(n.key.name));
 const update=world.properties.find(n=>n.key.name==='update'),phase=update.params[0],reduced=update.params[1],seconds=update.params[3];update.body.body.push(t.expressionStatement(t.callExpression(t.memberExpression(t.identifier('motion'),t.identifier('update')),[t.identifier(phase.name),t.identifier(seconds.name),t.identifier(reduced.name)])));
 p.replaceWithMultiple([t.expressionStatement(t.callExpression(t.identifier('harmonize'),[world.properties.find(n=>n.key.name==='root').value])),t.variableDeclaration('const',[t.variableDeclarator(t.identifier('motion'),t.callExpression(t.identifier('createNaturalMotion'),[world.properties.find(n=>n.key.name==='actors').value,adapters]))]),t.variableDeclaration('const',[t.variableDeclarator(t.identifier('world'),world)]),t.expressionStatement(t.callExpression(t.memberExpression(t.identifier('motion'),t.identifier('publish')),[t.identifier('world')])),t.returnStatement(t.identifier('world'))]);
 }});await fs.writeFile('src/scene/world.ts',generate(a,{jsescOption:{minimal:true}}).code+'\n');
for(const file of ['src/scene/sheep/timeline.ts','src/scene/sheep/SheepActor.ts','tests/geometry.spec.ts','tests/natural.spec.ts']){let s=await fs.readFile(file,'utf8');s=s.replace('../../enhancements','./natural').replace('../src/enhancements','../src/scene/sheep/natural');await fs.writeFile(file,s);}
await fs.unlink('src/enhancements.ts');
