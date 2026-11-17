import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const types={'.png':'image/png','.webp':'image/webp','.glb':'model/gltf-binary','.svg':'image/svg+xml'},cache=new Map(),assets=[];
async function embed(source){const urls=[...new Set(source.match(/\/assets\/[a-zA-Z0-9_.-]+/g)||[])];for(const url of urls){
 // Legacy modelSource diagnostic, not a loader URL. All real URLs must exist.
 if(url==='/assets/sheep.glb')continue;
 if(!cache.has(url)){const bytes=await readFile('public'+url),ext=url.slice(url.lastIndexOf('.'));cache.set(url,'data:'+types[ext]+';base64,'+bytes.toString('base64'));assets.push({url,sha256:createHash('sha256').update(bytes).digest('hex')});}source=source.replaceAll(url,cache.get(url));}return source;}
const js=(await embed(await readFile('dist/em.js','utf8'))).replaceAll('</script','<\\/script'),css=await embed(await readFile('dist/style.css','utf8'));
const icon=await embed('/assets/favicon.svg');
// Inert, compressed source backup. Assets already embedded above are referenced
// by digest instead of duplicated, so a later HTML-only handover stays editable.
const files={};async function sourceFiles(dir){for(const item of await readdir(dir,{withFileTypes:true}).catch(()=>[])){const name=dir+'/'+item.name;if(item.isDirectory())await sourceFiles(name);else if(/\.(?:tsx?|js|mjs|json|css|html|md|txt)$/.test(name))files[name]=await readFile(name,'utf8');}}
for(const dir of ['src','scripts','tests','recovered','docs'])await sourceFiles(dir);
for(const name of ['README.md','package.json','package-lock.json','tsconfig.json','playwright.config.ts','THIRD_PARTY_NOTICES.txt','.gitignore'])files[name]=await readFile(name,'utf8');
const packed=gzipSync(Buffer.from(JSON.stringify({schema:1,files,inlineAssets:assets})),{level:9}),snapshot=JSON.stringify({encoding:'gzip+base64',sha256:createHash('sha256').update(packed).digest('hex'),data:packed.toString('base64')});
const html='<!doctype html><html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101b2c"><title>Êm — Một khoảng bình yên</title><link rel="icon" href="'+icon+'"><style>'+css+'</style></head><body><div id="root"></div><script>'+js+'</script><script id="em-project-source" type="application/json">'+snapshot+'</script></body></html>';
await mkdir('artifacts',{recursive:true});await writeFile(process.argv[2]||'artifacts/em-final.html',html);console.log('Standalone:',Buffer.byteLength(html),'bytes;',cache.size,'embedded assets;',Object.keys(files).length,'recoverable source files.');
