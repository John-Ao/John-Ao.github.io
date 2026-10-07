import {analyze} from './engine.js';
onmessage=({data})=>{analyze(data,{onProgress:rows=>postMessage({rows})});postMessage({done:true});};
