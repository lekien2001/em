import fs from 'node:fs/promises';
import {parse} from '@babel/parser';
import traverseModule from '@babel/traverse';
import generatorModule from '@babel/generator';
import * as t from '@babel/types';
const traverse=traverseModule.default,generate=generatorModule.default;
const original=await fs.readFile('recovered/original-bundle.js','utf8');
const ast=parse(original,{sourceType:'script'});
const root=ast.program.body.find(n=>t.isExpressionStatement(n)&&t.isCallExpression(n.expression)&&t.isArrowFunctionExpression(n.expression.callee));
if(!root)throw new Error('Expected the verified standalone application IIFE');
let scope;traverse(ast,{ArrowFunctionExpression(p){if(p.node===root.expression.callee)scope=p.scope;}});
const rename={dG:'rawMeadowHeight',$h:'meadowHeight',SP:'groundHeight',be:'JUMP_YAW',PE:'BARNS',AE:'BARN_WIDTH',fi:'BARN_DEPTH',Ws:'DOOR_WIDTH',aD:'DOOR_HEIGHT',oL:'buildBarnGeometry'};
for(const [from,to]of Object.entries(rename)){if(!scope.hasOwnBinding(from))throw new Error('Missing verified source binding '+from);scope.rename(from,to);}
const code=generate(ast,{comments:true,compact:false}).code;
await fs.writeFile('recovered/readable-bundle.js',code);
const discovery=[];
traverse(ast,{
 Function(p){if(p.node===root.expression.callee)return;const src=generate(p.node,{compact:true}).code;if(src.includes('barnTriangles:')&&src.includes('Continuous felt meadow'))discovery.push({kind:'world',name:p.node.id?.name,bytes:src.length});},
 Class(p){let name=p.node.id?.name;if(!name&&t.isAssignmentExpression(p.parent))name=p.parent.left.name;const methods=p.node.body.body.filter(t.isClassMethod).map(m=>m.key.name);if(methods.includes('pose')||methods.includes('configure')&&methods.includes('sample'))discovery.push({kind:'class',name,methods});},
 AssignmentExpression(p){if(t.isMemberExpression(p.node.left)&&t.isIdentifier(p.node.left.property)&&/^is(Vector3|Quaternion|Bone|Group|SkinnedMesh|Mesh|Texture|Box3|Matrix4)$/.test(p.node.left.property.name))discovery.push({kind:'type',name:generate(p.node.left).code});}
});
await fs.writeFile('recovered/discovery.json',JSON.stringify(discovery,null,2));
console.log(discovery);console.log('Readable bundle bytes',code.length);
