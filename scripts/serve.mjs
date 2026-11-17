import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.glb':'model/gltf-binary'};
createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost'),file=path.resolve('dist','.'+(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(path.resolve('dist')+path.sep))throw new Error();const data=await readFile(file);res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});res.end(data);}catch{res.writeHead(404);res.end('Not found');}}).listen(4173,'0.0.0.0',()=>console.log('Êm preview http://127.0.0.1:4173'));
