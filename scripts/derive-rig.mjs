// Preserve original geometry, textures and the eleven original joints. Append
// only ear joints/weights; this does not regenerate or reshape the character.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const source='public/assets/a91596e96e28ba3c.glb',b=await fs.readFile(source);
const n=b.readUInt32LE(12),g=JSON.parse(b.toString('utf8',20,20+n)),bin=b.subarray(28+n);let data=Buffer.from(bin.subarray(0,g.buffers[0].byteLength));
const components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16},sizes={5121:1,5123:2,5125:4,5126:4};
function read(index){const a=g.accessors[index],v=g.bufferViews[a.bufferView],size=sizes[a.componentType],dim=components[a.type],stride=v.byteStride||size*dim,start=(v.byteOffset||0)+(a.byteOffset||0),out=[];
 for(let i=0;i<a.count;i++){const row=[];for(let c=0;c<dim;c++){const at=start+i*stride+c*size;row.push(a.componentType===5126?data.readFloatLE(at):data.readUIntLE(at,size));}out.push(row);}return out;}
function append(rows,componentType,type){const dim=components[type],size=sizes[componentType],bytes=Buffer.alloc(rows.length*dim*size);rows.forEach((row,i)=>row.forEach((v,c)=>{if(componentType===5126)bytes.writeFloatLE(v,(i*dim+c)*size);else bytes.writeUIntLE(v,(i*dim+c)*size,size);}));
 const padding=(4-data.length%4)%4;data=Buffer.concat([data,Buffer.alloc(padding),bytes]);const view=g.bufferViews.push({buffer:0,byteOffset:data.length-bytes.length,byteLength:bytes.length})-1;return g.accessors.push({bufferView:view,componentType,count:rows.length,type})-1;}
const loader=new GLTFLoader();loader.register(()=>({name:'geometry-only-derivation',loadTexture:async()=>new T.Texture()}));const model=await loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');model.scene.updateMatrixWorld(true);
const head=model.scene.getObjectByName('Head'),headNode=g.nodes.findIndex(n=>n.name==='Head'),inverse=read(g.skins[0].inverseBindMatrices),earJoints=[];
for(const [name,sign]of [['EarL',-1],['EarR',1]]){
 const local=head.worldToLocal(new T.Vector3(sign*.23,1.70,.79)),node=g.nodes.push({name,translation:local.toArray()})-1;
 (g.nodes[headNode].children??=[]).push(node);earJoints.push(g.skins[0].joints.length);g.skins[0].joints.push(node);
 const world=head.matrixWorld.clone().multiply(new T.Matrix4().makeTranslation(local.x,local.y,local.z));inverse.push(world.invert().toArray());
}
g.skins[0].inverseBindMatrices=append(inverse,5126,'MAT4');
let modified=0;
for(const p of g.meshes[0].primitives){
 const name=g.materials[p.material].name;if(!/beige|pink/.test(name))continue;
 const pos=read(p.attributes.POSITION),indices=read(p.indices).flat(),joints=read(p.attributes.JOINTS_0),weights=read(p.attributes.WEIGHTS_0),parents=pos.map((_,i)=>i),keys=new Map();
 const find=i=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;};const union=(a,b)=>parents[find(a)]=find(b);
 pos.forEach((p,i)=>{const key=p.map(v=>v.toFixed(5)).join(',');if(keys.has(key))union(i,keys.get(key));else keys.set(key,i);});
 for(let i=0;i<indices.length;i+=3){union(indices[i],indices[i+1]);union(indices[i],indices[i+2]);}
 const groups=new Map();pos.forEach((_,i)=>{const key=find(i);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i);});
 for(const ids of groups.values()){
  const min=[0,1,2].map(c=>Math.min(...ids.map(i=>pos[i][c]))),max=[0,1,2].map(c=>Math.max(...ids.map(i=>pos[i][c])));
  const ear=min[1]>1.45&&max[1]<1.9&&min[2]>.6&&max[2]<1&&((max[0]<-.1)||(min[0]>.1));if(!ear)continue;
  const index=earJoints[max[0]<0?0:1];
  for(const i of ids){const t=T.MathUtils.smoothstep(Math.abs(pos[i][0]),.23,.49);joints[i]=[2,index,0,0];weights[i]=[1-t,t,0,0];modified++;}
 }
 p.attributes.JOINTS_0=append(joints,5123,'VEC4');p.attributes.WEIGHTS_0=append(weights,5126,'VEC4');
}
if(modified!==1388)throw new Error('Unexpected ear component selection '+modified);
g.buffers[0].byteLength=data.length;g.asset.extras={...(g.asset.extras||{}),derivation:'Original 11 joints and geometry retained; two additive ear controls'};
let json=Buffer.from(JSON.stringify(g));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,0x20)]);const body=Buffer.concat([data,Buffer.alloc((4-data.length%4)%4)]),header=Buffer.alloc(12),jh=Buffer.alloc(8),bh=Buffer.alloc(8);
header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+body.length,8);jh.writeUInt32LE(json.length);jh.write('JSON',4);bh.writeUInt32LE(body.length);bh.write('BIN\0',4);
const result=Buffer.concat([header,jh,json,bh,body]);await fs.writeFile('public/assets/sheep-natural.glb',result);
await fs.writeFile('recovered/rig-derivation.json',JSON.stringify({source,sourceSha256:crypto.createHash('sha256').update(b).digest('hex'),output:'/assets/sheep-natural.glb',outputSha256:crypto.createHash('sha256').update(result).digest('hex'),earVertices:modified,joints:13,originalJoints:11,geometryUnchanged:true,animations:g.animations.map(a=>a.name)},null,2));
console.log('Ear rig appended:',modified,'vertices;',result.length,'bytes; original mesh buffers unchanged.');
