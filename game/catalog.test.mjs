import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {parseGameMetadata} from './catalog.js';
const source=JSON.parse(await readFile(new URL('./meta.json',import.meta.url),'utf8'));
test('grouped catalog preserves all unique entries and resolves supported page formats',async()=>{
 const groups=parseGameMetadata(source);
 assert.deepEqual(groups.map(g=>g.title),['单人解谜','棋类','桌游']);
 const games=groups.flatMap(g=>g.games);
 assert.equal(games.length,41);assert.equal(new Set(games.map(g=>g.game)).size,games.length);
 assert.equal(games.find(g=>g.game==='quarto').title,'连四棋');
 assert.equal(games.find(g=>g.game==='connect4').url,'/game/connect4.html');
 // Other catalog entries may be developed independently; check both supported URL formats.
 for(const id of ['quarto','connect4','othello']){const g=games.find(g=>g.game===id);await access(new URL('..'+g.url+(g.url.endsWith('/')?'index.html':''),import.meta.url));}
});
test('rejects duplicates across categories, invalid groups and unsafe game paths',()=>{
 const group={id:'puzzles',title:'单人解谜',games:[{game:'cube'}]};
 for(const value of [[group,group],[group,{...group,id:'other'}],[{...group,games:[{game:'../bad'}]}],[{...group,title:''}],[{game:'cube'}]])assert.throws(()=>parseGameMetadata(value));
 assert.deepEqual(parseGameMetadata([]),[]);
});
