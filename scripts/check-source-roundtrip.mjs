import {mkdtemp,readFile,readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import path from 'node:path';
const destination=await mkdtemp(path.join(tmpdir(),'em-source-roundtrip-'));
execFileSync(process.execPath,['scripts/restore-project.mjs',process.argv[2]||'artifacts/em-final.html',destination],{stdio:'inherit'});
const digest=b=>createHash('sha256').update(b).digest('hex');let checked=0;
async function compare(name){const original=await readFile(name),restored=await readFile(path.join(destination,name));if(digest(original)!==digest(restored))throw new Error('Roundtrip mismatch: '+name);checked++;}
async function sources(dir){for(const item of await readdir(dir,{withFileTypes:true})){const name=dir+'/'+item.name;if(item.isDirectory())await sources(name);else if(/\.(?:tsx?|js|mjs|json|css|html|md|txt)$/.test(name))await compare(name);}}
for(const dir of ['src','scripts','tests','recovered','docs'])await sources(dir);
for(const name of ['README.md','package.json','package-lock.json','tsconfig.json','playwright.config.ts','THIRD_PARTY_NOTICES.txt','.gitignore'])await compare(name);
const html=await readFile(process.argv[2]||'artifacts/em-final.html','utf8');
for(const item of await readdir(path.join(destination,'public/assets')))await compare('public/assets/'+item);
if(!html.includes('THIRD_PARTY')&&!html.includes('license'))throw new Error('Missing bundled notices');
console.log('Exact SHA-256 roundtrip:',checked,'source and asset files. No project code executed by restoration.');
