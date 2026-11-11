import {build} from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const out=process.argv[2]?path.resolve(process.argv[2]):path.join(here,'dist');await fs.mkdir(out,{recursive:true});
const {version}=JSON.parse(await fs.readFile(path.join(here,'package.json'),'utf8'));
const projectLicense=await fs.readFile(path.join(here,'../LICENSE'),'utf8');
const result=await build({
  absWorkingDir:here,entryPoints:['entry.tsx'],bundle:true,format:'iife',platform:'browser',
  target:['es2020'],jsx:'automatic',minify:true,write:false,metafile:true,legalComments:'inline',
  define:{
    'process.env.NODE_ENV':'"production"',
    APP_VERSION:JSON.stringify(version),
    PROJECT_LICENSE_TEXT:JSON.stringify(projectLicense),
  },
  logLevel:'warning',
});
const script=result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script');
const styles=['globals.css','motion-editor.css','project-about.css'];
const css=(await Promise.all(styles.map(file=>fs.readFile(path.join(here,'app',file),'utf8'))))
  .join('\n').replace(/<\/style/gi,'<\\/style');
if(/@import|url\(\s*["']?https?:/i.test(css))throw new Error('CSS contains a network dependency');
const external=Object.values(result.metafile.outputs).flatMap(o=>o.imports).filter(x=>x.external);if(external.length)throw new Error('External imports: '+JSON.stringify(external));
const licenses=await fs.readFile(path.join(here,'THIRD_PARTY_LICENSES.txt'),'utf8');
const html=`<!doctype html>
<!-- Disc Motion Lab · Copyright (C) 2026 345989 · SPDX-License-Identifier: MIT
     Source: https://github.com/345989/disc-motion-lab/tree/v${version}
     The project license is available in the page footer. Bundled dependencies retain their notices. -->
<html lang="zh-CN" id="top"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><meta name="description" content="飞盘动作实验室离线版：三维连杆、正反手动作与飞行模拟，无需联网或登录。"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; worker-src blob:; base-uri 'none'; object-src 'none'; form-action 'none'"><title>飞盘动作实验室 · 离线版 ${version}</title><style>${css}</style></head><body><noscript>本文件需要 JavaScript。请在浏览器中打开，不要使用聊天软件或文件管理器的静态预览。</noscript><div id="root"><p style="padding:24px;font:14px system-ui">正在本地启动飞盘动作实验室……如果此文字一直不变，请下载后使用浏览器打开，勿使用文件预览器。</p></div><script>${script}</script><script type="text/plain" id="third-party-licenses">${licenses.replace(/<\/script/gi,'&lt;/script')}</script></body></html>`;
const filename=path.join(out,`disc-motion-lab-offline-v${version}.html`);await fs.writeFile(filename,html);
await fs.writeFile(path.join(out,'build-audit.json'),JSON.stringify({version,htmlBytes:Buffer.byteLength(html),embeddedJavaScriptBytes:Buffer.byteLength(script),runtimeExternalImports:external,cssExternalResources:0,contentSecurityPolicyBlocksConnections:true,inputs:Object.keys(result.metafile.inputs)},null,2));
console.log(JSON.stringify({file:filename,bytes:Buffer.byteLength(html),externalImports:external.length}));
