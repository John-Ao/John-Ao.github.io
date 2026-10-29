import {build} from 'esbuild';
import {copyFile,mkdir,writeFile,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const here=path.dirname(fileURLToPath(import.meta.url));
await build({entryPoints:[path.join(here,'worker-entry.ts')],outfile:path.join(here,'../vendor/katago-worker.js'),bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,legalComments:'linked',nodePaths:[path.join(here,'node_modules')],define:{'import.meta.env.BASE_URL':'"/game/go/vendor/"'},logLevel:'info'});
await mkdir(path.join(here,'../vendor/tfjs'),{recursive:true});
for(const name of ['tfjs-backend-wasm.wasm','tfjs-backend-wasm-simd.wasm','tfjs-backend-wasm-threaded-simd.wasm'])await copyFile(path.join(here,'node_modules/@tensorflow/tfjs-backend-wasm/dist',name),path.join(here,'../vendor/tfjs',name));
await copyFile(path.join(here,'node_modules/pako/LICENSE'),path.join(here,'../vendor/PAKO-LICENSE.txt'));
