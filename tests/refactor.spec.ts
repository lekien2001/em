import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import {api} from './support/scene-api';
import {BufferGeometry,Float32BufferAttribute,Group,Mesh,MeshStandardMaterial,Texture} from 'three';
import {disposeObject} from '../src/assets/dispose';

test('typed modules match the captured phase, terrain and camera baseline',()=>{
 const baseline=JSON.parse(fs.readFileSync('tests/fixtures/refactor-baseline.json','utf8'));
 expect(api.MAIN_CAMERA).toEqual(baseline.camera);expect(api.CAMERA_LIMITS).toEqual(baseline.limits);expect(api.BARNS).toEqual(baseline.barns);
 const close=(actual:unknown,expected:unknown)=>{if(typeof expected==='number'){expect(actual).toBeCloseTo(expected,9);return;}if(expected&&typeof expected==='object'){expect(Object.keys(actual as object)).toEqual(Object.keys(expected));for(const key of Object.keys(expected))close((actual as Record<string,unknown>)[key],(expected as Record<string,unknown>)[key]);}else expect(actual).toEqual(expected);};
 for(const row of baseline.phases){close([0,1,2].map(i=>api.sheepPose(row.phase,i)),row.poses);close(api.barnDoors(row.phase),row.doors);expect(api.crossingCount(row.phase)).toBe(row.count);}
 for(const p of baseline.terrain)expect(api.groundHeight(p.x,p.z)).toBeCloseTo(p.height,9);
});

test('production graph contains npm libraries once and no recovery runtime',()=>{
 const inputs=Object.keys(JSON.parse(fs.readFileSync('dist/metafile.json','utf8')).inputs);
 expect(inputs.filter(n=>/recovered\/|migration\/|recovered-runtime|reference-runtime/.test(n))).toEqual([]);
 expect(inputs.filter(n=>/node_modules\/react\/cjs\/react\.production\.js$/.test(n))).toHaveLength(1);
 expect(inputs.filter(n=>/node_modules\/react-dom\/cjs\/react-dom-client\.production\.js$/.test(n))).toHaveLength(1);
 expect(inputs.filter(n=>/node_modules\/three\/build\/three.core.js$/.test(n))).toHaveLength(1);
 expect(inputs.some(n=>n==='src/ui/Toolbar.tsx')).toBe(true);
 expect(inputs.some(n=>n==='src/scene/SceneRenderer.ts')).toBe(true);
 const config=JSON.parse(fs.readFileSync('tsconfig.json','utf8'));expect(config.compilerOptions.strict).toBe(true);expect(config.compilerOptions.allowJs).not.toBe(true);
});

test('disposing cloned/shared scene resources twice releases each only once',()=>{
 const texture=new Texture(),material=new MeshStandardMaterial({map:texture}),geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute([0,0,0,1,0,0,0,1,0],3));
 const source=new Group(),scene=new Group();source.add(new Mesh(geometry,material));scene.add(source.clone(true));const counts={geometry:0,material:0,texture:0};
 geometry.addEventListener('dispose',()=>counts.geometry++);material.addEventListener('dispose',()=>counts.material++);texture.addEventListener('dispose',()=>counts.texture++);
 disposeObject(scene);disposeObject(source);disposeObject(scene);expect(counts).toEqual({geometry:1,material:1,texture:1});
});
