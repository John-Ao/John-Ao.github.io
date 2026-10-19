(function (root) {
  'use strict';
  const N = 20;
  const normalize = s => { const x = Math.min(...s.map(p=>p[0])), y = Math.min(...s.map(p=>p[1])); return s.map(p=>[p[0]-x,p[1]-y]).sort((a,b)=>a[1]-b[1]||a[0]-b[0]); };
  const key = s => JSON.stringify(normalize(s));
  const rotate = s => normalize(s.map(([x,y])=>[-y,x]));
  const flip = s => normalize(s.map(([x,y])=>[-x,y]));
  function variants(s) { const out = new Map(); for(let f=0;f<2;f++) { let t=f?flip(s):s; for(let r=0;r<4;r++,t=rotate(t)) out.set(key(t),normalize(t)); } return [...out.values()]; }
  // Enumerate all free polyominoes of orders 1–5 (1, 1, 2, 5, 12).
  const pieces = [[[0,0]]]; let level = pieces.slice();
  for(let n=2;n<=5;n++) { const next = new Map(); for(const s of level) for(const [x,y] of s) for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const p=[x+dx,y+dy]; if(s.some(q=>q[0]===p[0]&&q[1]===p[1])) continue; const t=normalize([...s,p]); const k=variants(t).map(key).sort()[0]; next.set(k,t); } level=[...next.values()]; pieces.push(...level); }
  const forms = pieces.map(variants);
  const corners = [[0,0],[19,0],[19,19],[0,19]];
  function create() { return {board:Array(400).fill(-1), used:Array.from({length:4},()=>[]), last:Array(4).fill(null), turn:0, ended:false, history:[]}; }
  function reason(g,c,s,x,y) {
    let touch=false;
    for(const [dx,dy] of s) { const a=x+dx,b=y+dy; if(a<0||b<0||a>=N||b>=N) return '棋块超出棋盘'; if(g.board[b*N+a]!==-1) return '不能与已有棋块重叠';
      for(const [u,v] of [[a-1,b],[a+1,b],[a,b-1],[a,b+1]]) if(u>=0&&v>=0&&u<N&&v<N&&g.board[v*N+u]===c) return '同色棋块只能角接，不能边接';
      for(const [u,v] of [[a-1,b-1],[a-1,b+1],[a+1,b-1],[a+1,b+1]]) if(u>=0&&v>=0&&u<N&&v<N&&g.board[v*N+u]===c) touch=true;
    }
    if(!g.used[c].length) return s.some(([dx,dy])=>x+dx===corners[c][0]&&y+dy===corners[c][1])?'':'首块必须覆盖本色的起始角';
    return touch?'':'至少与一块同色棋块角接';
  }
  // The clickable anchor is the first cell of the normalized shape, not
  // necessarily the top-left corner of its bounding box.
  function candidates(g,c,s) {
    if(g.ended||!s||!s.length) return [];
    const out=[], [ax,ay]=s[0];
    const width=Math.max(...s.map(p=>p[0]))+1, height=Math.max(...s.map(p=>p[1]))+1;
    for(let y=0;y<=N-height;y++) for(let x=0;x<=N-width;x++)
      if(!reason(g,c,s,x,y)) out.push({x,y,anchorX:x+ax,anchorY:y+ay});
    return out;
  }
  function find(g,c,only) {
    const targets=[];
    if(!g.used[c].length) targets.push(corners[c]);
    else for(let y=0;y<N;y++) for(let x=0;x<N;x++) if(!reason(g,c,[[0,0]],x,y)) targets.push([x,y]);
    for(let id=pieces.length-1;id>=0;id--) { if(g.used[c].includes(id)||(only!==undefined&&id!==only)) continue;
      for(const s of forms[id]) { const seen=new Set(); for(const [tx,ty] of targets) for(const [dx,dy] of s) { const x=tx-dx,y=ty-dy,k=x+','+y; if(seen.has(k)) continue; seen.add(k); if(!reason(g,c,s,x,y)) return {id,s,x,y}; } }
    } return null;
  }
  function play(g,id,s,x,y) { const c=g.turn; if(g.ended||!pieces[id]||g.used[c].includes(id)||!forms[id].some(t=>key(t)===key(s))||key(s)!==JSON.stringify(s)) return false; if(reason(g,c,s,x,y)) return false;
    for(const [dx,dy] of s) g.board[(y+dy)*N+x+dx]=c;
    g.used[c].push(id); g.last[c]=id; g.history.push({id,s,x,y});
    const skipped=[]; for(let i=1;i<=4;i++) { const next=(c+i)%4; if(find(g,next)) { g.turn=next; return {skipped}; } skipped.push(next); } g.ended=true; return {skipped};
  }
  function score(g,c) { return g.board.reduce((total,color)=>total+(color===c?1:0),0); }
  function playerScores(g,players) { const values=[0,1,2,3].map(c=>score(g,c)); return players===4?values:[values[0]+values[2],values[1]+values[3]]; }
  const api={N,pieces,forms,corners,normalize,rotate,flip,variants,create,reason,candidates,find,play,score,playerScores};
  if(typeof module!=='undefined') module.exports=api; else root.Blokus=api;
})(globalThis);
