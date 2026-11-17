import fs from'node:fs/promises';import{parse}from'@babel/parser';import tr from'@babel/traverse';import gen from'@babel/generator';import*as t from'@babel/types';const traverse=tr.default,generate=gen.default;const parser=s=>parse(s,{sourceType:'module',plugins:['typescript','jsx']});
const a=parser(await fs.readFile('src/app/App.tsx','utf8'));let app;traverse(a,{FunctionDeclaration(p){if(p.node.id?.name==='App')app=p;}});
const imports=a.program.body.filter(t.isImportDeclaration);
async function component(name,node,free){
 const props=[...free].sort(),type=`Pick<ControlsProps,${props.map(x=>JSON.stringify(x)).join('|')}>`,head=parser(`import type{ControlsProps}from'./types';export function ${name}({${props.join(',')}}:${type}){return null;}`).program;
 const fn=head.body[1].declaration;fn.body.body[0].argument=t.cloneNode(node,true);head.body.unshift(...imports.filter(n=>!n.source.value.endsWith('/types')));
 await fs.writeFile('src/ui/'+name+'.tsx',generate(t.file(head),{jsescOption:{minimal:true}}).code+'\n');
 a.program.body.unshift(t.importDeclaration([t.importSpecifier(t.identifier(name),t.identifier(name))],t.stringLiteral('../ui/'+name)));
 return t.jsxElement(t.jsxOpeningElement(t.jsxIdentifier(name),props.map(p=>t.jsxAttribute(t.jsxIdentifier(p),t.jsxExpressionContainer(t.identifier(p)))),true),null,[]);
}
function freeProps(node){const names=new Set();traverse(t.file(t.program([t.expressionStatement(t.cloneNode(node,true))])),{ReferencedIdentifier(p){const n=p.node.name;if(!p.scope.getBinding(n)&&app.scope.hasOwnBinding(n))names.add(n);}});return names;}
let optionsPath;app.traverse({VariableDeclarator(p){if(p.node.id.name==='sceneOptions')optionsPath=p;}});const options=optionsPath.node.init;optionsPath.get('init').replaceWith(await component('SceneOptions',options,freeProps(options)));
let toolbar;app.traverse({JSXElement(p){if(p.node.openingElement.attributes.some(x=>t.isJSXAttribute(x)&&x.name.name==='className'&&t.isJSXExpressionContainer(x.value)&&t.isStringLiteral(x.value.expression,{value:'minimal-bar'})))toolbar=p;}});toolbar.replaceWith(await component('Toolbar',toolbar.node,freeProps(toolbar.node)));
let touch;app.traverse({ConditionalExpression(p){if(t.isMemberExpression(p.node.test)&&p.node.test.object.name==='immersion'&&p.node.test.property.name==='desktop')touch=p.get('alternate');}});touch.replaceWith(await component('TouchControls',touch.node,freeProps(touch.node)));
let main;app.traverse({JSXElement(p){if(p.node.openingElement.name.name==='main')main=p;}});const panels=[];main.node.children=main.node.children.filter(n=>{if(!t.isJSXExpressionContainer(n)||!t.isLogicalExpression(n.expression))return true;const f=freeProps(n.expression);if(f.has('panel')){panels.push(n);return false;}return true;});
const fragment=t.jsxFragment(t.jsxOpeningFragment(),t.jsxClosingFragment(),panels);main.node.children.push(await component('SessionPanels',fragment,freeProps(fragment)));
a.program.body=a.program.body.filter(n=>!(t.isTSTypeAliasDeclaration(n)&&n.id.name==='Panel'));a.program.body.unshift(t.importDeclaration([t.importSpecifier(t.identifier('Panel'),t.identifier('Panel'))],t.stringLiteral('../ui/types')));
await fs.writeFile('src/app/App.tsx',generate(a,{jsescOption:{minimal:true}}).code+'\n');
