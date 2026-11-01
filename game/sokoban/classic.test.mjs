import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { levels, groups } from './catalog.mjs';
import { move, solved, solve } from './model.mjs';
import { collections, parseCollection } from './import-levels.mjs';
import { readStore, STORAGE_KEY } from './storage.mjs';

test('only imported classics, unique IDs and unchanged source maps', () => {
  assert.ok(levels.length > 24);
  assert.deepEqual(groups, ['Microban', 'Microban II', 'Sasquatch']);
  assert.equal(new Set(levels.map(l=>l.id)).size, levels.length);
  for (const number of [79,10,13,49,61,43,37,73,70,68,6,54,64,35,74,75,69,80,16,72,65,60,77,76])
    assert.ok(levels.some(l=>l.id===`microban-${number}`));
  const sources = collections.flatMap(([id,group])=>parseCollection(readFileSync(new URL(`./sources/${id}.txt`,import.meta.url),'utf8'),id,group));
  for(const l of levels) {
    const {solution,proof,...layout}=l;
    assert.deepEqual(layout,sources.find(source=>source.id===l.id));
    assert.ok(l.boxes.length >= 3);
    assert.ok(l.proof.minimumPushes >= 18);
  }
});
test('every imported level has a legal solution and independently verified minimum pushes', () => {
  for(const l of levels) {
    let state={player:l.player,boxes:l.boxes.slice(),moves:0,pushes:0};
    for(const dir of l.solution) {state=move(l,state,dir);assert.ok(state,l.id);}
    assert.ok(solved(l,state),l.id);
    assert.equal(state.pushes,l.proof.minimumPushes);
    const proof=solve(l,{budget:20000});
    assert.ok(proof.complete && proof.solvable,l.id);
    assert.equal(proof.minimumPushes,l.proof.minimumPushes);
  }
});
test('save migration preserves classics, drops practice and prefers stable v2 IDs', () => {
  const state={player:1,boxes:[2],moves:0,pushes:0};
  const storage=(values)=>({getItem:key=>values[key]??null});
  assert.deepEqual(readStore(storage({'sokoban-v1':JSON.stringify({current:60,0:state,60:state})})),{current:'microban-79','microban-79':state});
  assert.deepEqual(readStore(storage({'sokoban-v1':JSON.stringify({current:0,0:state})})),{});
  const v2={current:'sasquatch-1','sasquatch-1':state};
  assert.deepEqual(readStore(storage({[STORAGE_KEY]:JSON.stringify(v2)})),v2);
  for(const value of ['null','[]','1','broken'])assert.deepEqual(readStore(storage({[STORAGE_KEY]:value})),{});
});
