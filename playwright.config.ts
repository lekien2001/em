import {defineConfig} from '@playwright/test';
import {existsSync} from 'node:fs';
export default defineConfig({testDir:'tests',workers:1,fullyParallel:false,timeout:90000,expect:{timeout:15000},webServer:{command:'npm run build && npm run preview',url:'http://127.0.0.1:4173',reuseExistingServer:true,timeout:120000},use:{baseURL:'http://127.0.0.1:4173',headless:true,launchOptions:{executablePath:process.env.CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']}}});
