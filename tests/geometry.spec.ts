import {test,expect} from '@playwright/test';
import {Raycaster,Vector3} from 'three';
import fs from 'node:fs';
import {api} from './support/scene-api';
import {FaceAttachment} from '../src/face/FaceAttachment';
import {prepareControllers,type Actor,type Adapters} from '../src/scene/sheep/natural';
const a:Adapters={...api,getPose:api.sheepPose,getAge:api.sheepAge,barns:api.BARNS};
async function actor(){const loader=new api.GLTFLoader();loader.register(()=>({name:'geometry-only-qa',loadTexture:async()=>new api.Texture()}));const b=fs.readFileSync('public/assets/sheep-natural.glb');return new api.SheepActor(await loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),''));}
function setPose(actor:Actor,t:number,delta=.05){const p=api.sheepPose(t,0);actor.root.position.set(p.x,api.groundHeight(p.x,p.z)+p.y,p.z);actor.root.rotation.y=p.yaw;actor.pose(p.state,p.clipTime,delta,1,p.visible);return p;}

test('softened barns stay within budget and conceal both ends from every permitted orbit',async()=>{
 const root=new api.Group(),barns=await api.createBarns(root,{texture:async()=>new api.Texture()}),ray=new Raycaster();
 const shadows=barns.doors.reduce((n:number,m:any)=>n+m.geometry.attributes.position.count/3,0);expect(barns.triangles+shadows).toBeLessThanOrEqual(20000);expect(barns.drawCalls+barns.doors.length).toBeLessThanOrEqual(12);
 console.log('barn geometry including door shadows',barns.triangles+shadows,'triangles',barns.drawCalls+barns.doors.length,'draws');
 for(const t of [17.999,18.001]){barns.update(t);root.updateMatrixWorld(true);const b=api.BARNS[t>18?0:1];expect(api.barnDoors(t)).toEqual({entry:0,exit:0});
  for(let i=0;i<8;i++)for(const radius of [16,28])for(const polar of [1.05,1.48]){
   const eye=new Vector3(.5+radius*Math.sin(polar)*Math.sin(i*Math.PI/4),1.4+radius*Math.cos(polar),-.4+radius*Math.sin(polar)*Math.cos(i*Math.PI/4));
   for(const x of [-.95,.95])for(const z of [-1.4,1.4])for(const y of [.06,2.3]){const q=api.barnPoint(b,x,z),target=new Vector3(q.x,api.groundHeight(b.x,b.z)+y,q.z),distance=eye.distanceTo(target);ray.set(eye,target.sub(eye).normalize());const hit=ray.intersectObject(root,true)[0];expect(hit&&hit.distance<distance-.02,`${b.id} orbit ${i} ${x}/${y}/${z}`).toBe(true);}
  }
 }
 api.disposeObject(root);
});

test('natural rig clears swinging doors and perpendicular fence through a full cycle',async()=>{
 const root=new api.Group(),barns=await api.createBarns(root,{texture:async()=>new api.Texture()}),sheep=await actor(),{controllers}=prepareControllers([sheep],a),point=new api.Vector3(),local=new api.Vector3(),collisions=new Set<string>();
 const face=new FaceAttachment([sheep.root],['full-beard']);
 for(let t=0;t<18;t+=.025){const p=setPose(sheep,t,.025);controllers[0].update(t,t,false);barns.update(t);root.updateMatrixWorld(true);sheep.root.updateMatrixWorld(true);
  const inverses=barns.doors.map((d:any)=>d.matrixWorld.clone().invert());
  sheep.root.traverse((o:any)=>{if(!o.isSkinnedMesh&&!o.name.startsWith('Felt sheep face ·')&&o.name!=='Felt forehead tufts')return;o.skeleton?.update();expect(o.material.opacity).toBe(1);expect(o.material.transparent).toBe(false);
   for(let v=0;v<o.geometry.attributes.position.count;v++){
    o.getVertexPosition(v,point).applyMatrix4(o.matrixWorld);
    if(t<4.8||t>13)for(let d=0;d<inverses.length;d++){local.copy(point).applyMatrix4(inverses[d]);const x=local.x*(d%2===0?1:-1);if(x>.02&&x<1.38&&local.y>.03&&local.y<2.52&&Math.abs(local.z)<.065)collisions.add(`door ${d}, t ${t.toFixed(2)}`);}
    if(p.state==='Jump'){const c=Math.cos(api.JUMP_YAW),s=Math.sin(api.JUMP_YAW),along=point.x*c-point.z*s,n=point.x*s+point.z*c,y=point.y-api.groundHeight(0,0);if(Math.abs(along)<.17&&Math.abs(n)<.17&&y>-.09&&y<1.61||Math.abs(along)<2.925&&Math.abs(n+.025)<.095&&(y>.415&&y<.645||y>.975&&y<1.205))collisions.add('fence at '+t.toFixed(2));}
   }
  });
 }
 expect([...collisions]).toEqual([]);face.dispose();sheep.dispose();api.disposeObject(root);
});

test('root path and velocity stay continuous while landing/takeoff heights are preserved',()=>{
 const eps=1e-5;for(const t of [.8,6.4,7.6,8.8,9.3,13.7,16.2]){const b=api.sheepPose(t-eps,0),c=api.sheepPose(t+eps,0),a=api.sheepPose(t-2*eps,0),d=api.sheepPose(t+2*eps,0);for(const k of ['x','y','z'])expect(Math.abs((b[k]-a[k])/eps-(d[k]-c[k])/eps)).toBeLessThan(.002);}
 expect(api.sheepPose(7.6,0).x).toBeCloseTo(0,8);expect(api.sheepPose(7.6,0).z).toBeCloseTo(0,8);expect(api.sheepPose(7.6,0).y).toBeCloseTo(1.85,8);
});
