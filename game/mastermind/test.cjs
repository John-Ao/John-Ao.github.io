const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/app.js','utf8');
const scoring=source.slice(source.indexOf('function score('),source.indexOf('function valid('));
const context=vm.createContext({});vm.runInContext(scoring,context);
assert.equal(JSON.stringify(context.score([0,0,0,0],[0,1,2,3])),'[2,0,0,0]');
assert.equal(JSON.stringify(context.score([1,0,0,2],[0,1,2,0])),'[1,1,1,1]');
assert.equal(JSON.stringify(context.score([0,0,1,1],[0,1,2,3])),'[2,0,1,0]');
for(let a=0;a<256;a++)for(let g=0;g<256;g++){const digits=n=>[0,1,2,3].map(i=>(n>>(i*2))&3),answer=digits(a),guess=digits(g),s=context.score(guess,answer);assert.equal(s.filter(x=>x===2).length,guess.filter((v,i)=>v===answer[i]).length);const total=[0,1,2,3].reduce((n,c)=>n+Math.min(guess.filter(x=>x===c).length,answer.filter(x=>x===c).length),0);assert.equal(s.filter(Boolean).length,total)}
console.log('Passed 65,536 duplicate-color scoring combinations.');
