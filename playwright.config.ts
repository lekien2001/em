import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'tests',workers:1,fullyParallel:false,timeout:90000,expect:{timeout:15000},use:{baseURL:'http://127.0.0.1:4173',headless:true,launchOptions:{executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']}}});
