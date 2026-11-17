import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import path from 'node:path';
const [htmlFile,destination]=process.argv.slice(2);if(!htmlFile||!destination)throw new Error('Usage: node scripts/restore-project.mjs file.html empty-project-folder');
const html=await readFile(htmlFile,'utf8'),match=html.match(/<script id="em-project-source" type="application\/json">([^<]+)<\/script>/);if(!match)throw new Error('This HTML has no structured source backup');
const info=JSON.parse(match[1]),packed=Buffer.from(info.data,'base64'),digest=b=>createHash('sha256').update(b).digest('hex');if(digest(packed)!==info.sha256)throw new Error('Source backup digest mismatch');
const snapshot=JSON.parse(gunzipSync(packed)),base=path.resolve(destination);if(snapshot.schema!==1)throw new Error('Unknown source schema');
async function write(name,bytes){const file=path.resolve(base,name);if(!file.startsWith(base+path.sep))throw new Error('Invalid path in archive');await mkdir(path.dirname(file),{recursive:true});await writeFile(file,bytes);}
for(const [file,source]of Object.entries(snapshot.files))await write(file,source);
const wanted=new Map(snapshot.inlineAssets.map(a=>[a.sha256,a.url])),found=new Set();
for(const m of html.matchAll(/data:(?:image\/png|image\/webp|image\/svg\+xml|model\/gltf-binary);base64,([A-Za-z0-9+/=]+)/g)){
 const bytes=Buffer.from(m[1],'base64'),sha=digest(bytes),url=wanted.get(sha);if(url&&!found.has(sha)){await write('public'+url,bytes);found.add(sha);}
}
if(found.size!==wanted.size)throw new Error('Missing embedded assets');
const original=JSON.parse(snapshot.files['recovered/source-model-rebuild.json']),derived=await readFile(path.join(base,'public'+original.derivedUrl)),start=28+derived.readUInt32LE(12),result=Buffer.concat([Buffer.from(original.prefix,'base64'),derived.subarray(start,start+original.rawBufferLength),Buffer.from(original.padding,'base64')]);
if(digest(result)!==original.sha256)throw new Error('Original source model reconstruction mismatch');await write('public'+original.sourceUrl,result);
console.log('Restored',Object.keys(snapshot.files).length,'source files,',found.size,'embedded assets and the exact protected source model to',base);
