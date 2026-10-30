/* Rule mechanics from the official v1 manual. Positions returned zero-based. */
(function(root){
const colors=['red','blue','green','yellow'];
function wireAnswer(w,odd){const n=c=>w.filter(x=>x===c).length,last=w.length-1;switch(w.length){case 3:return !n('red')?1:w[last]==='white'?last:n('blue')>1?w.lastIndexOf('blue'):last;case 4:return n('red')>1&&odd?w.lastIndexOf('red'):w[last]==='yellow'&&!n('red')?0:n('blue')===1?0:n('yellow')>1?last:1;case 5:return w[last]==='black'&&odd?3:n('red')===1&&n('yellow')>1?0:!n('black')?1:0;case 6:return !n('yellow')&&odd?2:n('yellow')===1&&n('white')>1?3:!n('red')?last:3;}}
function mustHold(color,label,batteries,car,frk){if(color==='blue'&&label==='ABORT')return true;if(batteries>1&&label==='DETONATE')return false;if(color==='white'&&car)return true;if(batteries>2&&frk)return false;if(color==='yellow')return true;if(color==='red'&&label==='HOLD')return false;return true;}
function simonAnswer(flash,vowel,strikes){const table=vowel?[[1,0,3,2],[3,2,1,0],[2,0,3,1]]:[[1,3,2,0],[0,1,3,2],[3,2,1,0]];return colors[table[Math.min(strikes,2)][colors.indexOf(flash)]];}
function memoryAnswer(stage,d,keys,h){const label=x=>keys.indexOf(x);if(stage===0)return [1,1,2,3][d-1];if(stage===1)return [label(4),h[0].pos,0,h[0].pos][d-1];if(stage===2)return [label(h[1].label),label(h[0].label),2,label(4)][d-1];if(stage===3)return [h[0].pos,0,h[1].pos,h[1].pos][d-1];return label(h[[0,1,3,2][d-1]].label);}
const api={wireAnswer,mustHold,simonAnswer,memoryAnswer};if(typeof module!=='undefined')module.exports=api;else root.Rules=api;
})(globalThis);

// Shared deterministic helpers, used by the game and regression tests.
(function(root){
const api=typeof module!=='undefined'?module.exports:root.Rules;
const data=typeof module!=='undefined'?require('./data.js'):DATA;
api.words='about after again below could every first found great house large learn never other place plant point right small sound spell still study their there these thing think three water where which world would write'.split(' ');
api.morseWords='shell halls slick trick boxes leaks strobe bistro flick bombs break brick steak sting vector beats'.split(' ');
api.frequencies=[505,515,522,532,535,542,545,552,555,565,572,575,582,592,595,600];
api.morse=Object.fromEntries('a:.- b:-... c:-.-. d:-.. e:. f:..-. g:--. h:.... i:.. j:.--- k:-.- l:.-.. m:-- n:-. o:--- p:.--. q:--.- r:.-. s:... t:- u:..- v:...- w:.-- x:-..- y:-.-- z:--..'.split(' ').map(s=>s.split(':')));
api.sequence={red:['C','B','A','AC','B','AC','ABC','AB','B'],blue:['B','AC','B','A','B','BC','C','AC','A'],black:['ABC','AC','B','AC','B','BC','AB','C','C']};
api.complexCode=wire=>data.complexCodes[(wire.red?1:0)|(wire.blue?2:0)|(wire.star?4:0)|(wire.led?8:0)];
api.complexCut=(wire,bomb)=>({C:true,D:false,S:Number(bomb.serial.at(-1))%2===0,P:bomb.parallel,B:bomb.batteries>=2})[api.complexCode(wire)];
api.sequenceCut=(color,occurrence,destination)=>api.sequence[color][occurrence-1].includes(destination);
api.whoAnswer=(display,labels)=>{const key=labels[data.whoLook[display]];return labels.indexOf(data.whoPriority[key].find(label=>labels.includes(label)));};
api.mazeMove=(maze,pos,dir)=>{const [dx,dy]=[[0,-1],[1,0],[0,1],[-1,0]][dir],x=pos%6,y=Math.floor(pos/6),nx=x+dx,ny=y+dy;if(nx<0||nx>5||ny<0||ny>5)return pos;const blocked=maze.walls.some(([x1,y1,x2,y2])=>dx?x1===x2&&x1===Math.max(x,nx)&&Math.min(y1,y2)<=y&&Math.max(y1,y2)>=y+1:y1===y2&&y1===Math.max(y,ny)&&Math.min(x1,x2)<=x&&Math.max(x1,x2)>=x+1);return blocked?pos:ny*6+nx;};
api.morseTimeline=word=>{const a=[];for(let i=0;i<word.length;i++){const code=api.morse[word[i]];for(let j=0;j<code.length;j++){a.push([true,code[j]==='.'?1:3]);a.push([false,j===code.length-1?(i===word.length-1?7:3):1]);}}return a;};
api.passwordCandidates=columns=>api.words.filter(w=>[...w].every((c,i)=>columns[i].includes(c)));
})(globalThis);
