import {analyze} from './engine.js';
self.onmessage=({data})=>{analyze(data.board,data.players,data.turn,{onProgress:items=>self.postMessage(items)});self.postMessage({done:true});};
