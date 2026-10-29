import {defineConfig} from 'vitest/config';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const here=path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({root:path.join(here,'../vendor/katago-src'),resolve:{alias:{'@tensorflow/tfjs-backend-wasm':path.join(here,'node_modules/@tensorflow/tfjs-backend-wasm/dist/tf-backend-wasm.node.js'),'@tensorflow/tfjs':path.join(here,'node_modules/@tensorflow/tfjs/dist/tf.node.js')}},test:{include:['test/engineGolden.test.ts','test/engineBoardSizes.test.ts','test/engineAccuracy.test.ts'],pool:'forks',maxWorkers:1,testTimeout:120000}});
