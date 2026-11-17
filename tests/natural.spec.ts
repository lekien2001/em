import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import boot from '../src/recovered-runtime.js';
import {prepareControllers,type Actor,type Adapters} from '../src/enhancements';
const api:any=boot({testMode:true});
async function rig(file='sheep-natural.glb'){
 const loader=new api.GLTFLoader();loader.register(()=>({name:'geometry-only-qa',loadTexture:async()=>new api.Texture()}));const bytes=fs.readFileSync('public/assets/'+file);return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
}
const adapters:Adapters={...api,getPose:api.sheepPose,getAge:api.sheepAge,barns:api.BARNS};
function pose(actor:Actor,phase:number,index=0,delta=.025){const p=api.sheepPose(phase,index);actor.root.position.set(p.x,api.groundHeight(p.x,p.z)+p.y,p.z);actor.root.rotation.y=p.yaw;actor.pose(p.state,p.clipTime,delta,1,p.visible);actor.root.updateMatrixWorld(true);return p;}

test('exit floor matches the field; no surrounding mound or altered distant hills',()=>{
 const floor=api.groundHeight(0,0);expect(api.groundHeight(7.3,-7.7)).toBeCloseTo(floor,10);
 for(const x of [-1.8,0,1.8])for(const z of [-2.1,0,2.1]){const q=api.barnPoint(api.BARNS[1],x,z);expect(api.groundHeight(q.x,q.z)).toBeCloseTo(floor,8);}
 let high=-Infinity;for(let x=3;x<=11;x+=.25)for(let z=-12;z<=-3;z+=.25)high=Math.max(high,api.meadowHeight(x,z));expect(high-floor).toBeLessThan(.22);
 expect(api.meadowHeight(88,0)).toBeGreaterThan(5);expect(api.meadowHeight(0,160)).toBeGreaterThan(8);
});

test('original asset is protected; ear derivative keeps geometry, four clips and original joints',async()=>{
 const old=fs.readFileSync('public/assets/a91596e96e28ba3c.glb');expect(createHash('sha256').update(old).digest('hex')).toBe('a91596e96e28ba3c1be41219a167ed87f74e01ab65b364c4a317a68d180a5838');
 const source=await rig('a91596e96e28ba3c.glb'),derived=await rig();expect(derived.animations.map((a:any)=>a.name).sort()).toEqual(['Idle','Jump','Land','Walk']);
 const meshes=(root:any)=>{const list:any[]=[];root.traverse((o:any)=>{if(o.isSkinnedMesh)list.push(o);});return list;},a=meshes(source.scene),b=meshes(derived.scene);
 expect(a.length).toBe(4);expect(b.length).toBe(4);expect(b[0].skeleton.bones.map((b:any)=>b.name).slice(0,11)).toEqual(a[0].skeleton.bones.map((b:any)=>b.name));expect(b[0].skeleton.bones).toHaveLength(13);
 for(let i=0;i<a.length;i++){for(const name of ['position','normal','uv'])expect(Array.from(b[i].geometry.attributes[name].array)).toEqual(Array.from(a[i].geometry.attributes[name].array));expect(Array.from(b[i].geometry.index.array)).toEqual(Array.from(a[i].geometry.index.array));}
 source.scene.updateMatrixWorld(true);derived.scene.updateMatrixWorld(true);let deviation=0;
 for(let m=0;m<a.length;m++)for(let v=0;v<a[m].geometry.attributes.position.count;v++){const p=a[m].getVertexPosition(v,new api.Vector3()),q=b[m].getVertexPosition(v,new api.Vector3());deviation=Math.max(deviation,p.distanceTo(q));}expect(deviation).toBeLessThan(.000002);
});

test('stance foot targets stay on the floor; IK stays bounded and deterministic',async()=>{
 const source=await rig(),actor=new api.SheepActor(source),{controllers,calibration}=prepareControllers([actor],adapters),c=controllers[0];let maxPin=0,maxGround=0,contacts=0;
 console.log('calibration',calibration.map(f=>({name:f.name,centre:f.centre,pole:f.pole,offset:f.offset.toArray()})));
 for(let t=1.1;t<15.95;t+=.025){const p=pose(actor,t);c.update(t,t-1,false);if(p.state!=='Walk')continue;for(const f of c.diagnostics.feet)if(f.stance>.99){contacts++;if(f.error>maxPin&&f.error>.025)console.log('pin deviation',t,f);maxPin=Math.max(maxPin,f.error);maxGround=Math.max(maxGround,Math.abs(f.groundError));}}
 console.log({maxPin,maxGround,contacts});expect(contacts).toBeGreaterThan(150);expect(maxPin).toBeLessThan(.025);expect(maxGround).toBeLessThan(.025);
 const t=4.35;pose(actor,t);c.update(t,4,false);const before=actor.root.getObjectByName('FrontLLower').getWorldPosition(new api.Vector3()),body=actor.root.getObjectByName('Body'),scale=body.scale.clone(),head=actor.root.getObjectByName('Head').quaternion.clone();
 for(let k=0;k<100;k++){pose(actor,t,0,0);c.update(t,4,false);expect(before.distanceTo(actor.root.getObjectByName('FrontLLower').getWorldPosition(new api.Vector3()))).toBeLessThan(.00001);expect(scale.distanceTo(body.scale)).toBeLessThan(.000001);expect(head.angleTo(actor.root.getObjectByName('Head').quaternion)).toBeLessThan(.000001);}actor.dispose();
});

test('micro movement is subtle, staggered, frozen on pause and off under reduced motion',async()=>{
 const source=await rig(),actors=[new api.SheepActor(source),new api.SheepActor(source)],{controllers}=prepareControllers(actors,adapters);let maxEar=0,maxHead=0;
 for(let seconds=0;seconds<30;seconds+=.2)for(let i=0;i<actors.length;i++){pose(actors[i],4.2+i*6,i,0);controllers[i].update(4.2+i*6,seconds,false);maxEar=Math.max(maxEar,Math.abs(controllers[i].diagnostics.earL),Math.abs(controllers[i].diagnostics.earR));maxHead=Math.max(maxHead,Math.abs(controllers[i].diagnostics.headYaw));}
 expect(maxEar).toBeGreaterThan(.01);expect(maxEar).toBeLessThan(.056);expect(maxHead).toBeLessThan(.036);
 pose(actors[0],4.2);controllers[0].update(4.2,8,true);expect(Math.abs(controllers[0].diagnostics.headYaw)).toBe(0);expect(Math.abs(controllers[0].diagnostics.earL)).toBe(0);expect(Math.abs(controllers[0].diagnostics.earR)).toBe(0);actors.forEach(a=>a.dispose());
});

test('analytical count, opaque recycled sheep and shared active clock survive pause and speed changes',()=>{
 for(const rate of [1,1.5]){const c=new api.SceneClock(0);c.configure(0,true,rate);let n=0;for(let ms=100;ms<=120000;ms+=100)n+=c.sample(ms).crossings;const paused=c.configure(120000,false,rate);expect(n).toBe(api.crossingCount(paused.phase));expect(paused.activeSeconds).toBeCloseTo(120);const after=c.sample(180000);expect(after.phase).toBe(paused.phase);expect(after.activeSeconds).toBe(paused.activeSeconds);c.reset(180000);expect(c.sample(180000).activeSeconds).toBe(0);}
 for(const t of [17.999,18.001])expect(api.barnDoors(t)).toEqual({entry:0,exit:0});
 expect(Math.cos(api.JUMP_YAW)*2-Math.sin(api.JUMP_YAW)*.8).toBeCloseTo(0,10);expect(api.sheepPose(7.6,0).y).toBe(1.85);
});
