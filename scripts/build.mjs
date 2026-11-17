import {build} from 'esbuild';
import {mkdir,readFile,writeFile,cp} from 'node:fs/promises';
await mkdir('dist/assets',{recursive:true});await cp('public/assets','dist/assets',{recursive:true});
await build({entryPoints:['src/main.ts'],bundle:true,minify:true,sourcemap:false,format:'iife',target:'es2022',outfile:'dist/em.js',footer:{js:await readFile('THIRD_PARTY_NOTICES.txt','utf8')}});
await cp('src/style.css','dist/style.css');
await writeFile('dist/index.html','<!doctype html><html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101b2c"><title>Êm — Một khoảng bình yên</title><link rel="icon" href="/assets/favicon.svg"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/em.js"></script></body></html>');
console.log('Production build:',(await readFile('dist/em.js')).length,'bytes; assets restored from the supplied HTML.');
