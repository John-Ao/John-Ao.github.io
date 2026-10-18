/* Standard turn-based TACTA rules on continuous polygon geometry. */
(function (root) {
  'use strict';
  const C = typeof module!=='undefined' ? require('./cards') : root.TactaCards;
  const EPS=1e-6, AREA_EPS=.015;
  const cross=(a,b,p)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
  const signedArea=p=>p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-a[1]*b[0];},0)/2;
  const area=p=>Math.abs(signedArea(p));
  const ccw=p=>signedArea(p)<0?[...p].reverse():p;
  const center=p=>[p.reduce((s,v)=>s+v[0],0)/p.length,p.reduce((s,v)=>s+v[1],0)/p.length];
  function halfPlane(poly,a,b,inside=true) {
    if(!poly.length)return [];
    const out=[],sign=inside?1:-1;
    for(let i=0;i<poly.length;i++) {
      const p=poly[i],q=poly[(i+1)%poly.length],dp=cross(a,b,p)*sign,dq=cross(a,b,q)*sign;
      if(dp>=-EPS)out.push(p);
      if((dp>EPS&&dq < -EPS)||(dp < -EPS&&dq>EPS)) {
        const t=dp/(dp-dq);out.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);
      }
    }
    return out;
  }
  function intersect(a,b) {let p=a;const clip=ccw(b);for(let i=0;i<clip.length&&p.length;i++)p=halfPlane(p,clip[i],clip[(i+1)%clip.length]);return p;}
  function subtract(poly,clip) {
    let remaining=poly;const fragments=[],b=ccw(clip);
    for(let i=0;i<b.length&&remaining.length;i++) {
      const outside=halfPlane(remaining,b[i],b[(i+1)%b.length],false);
      if(area(outside)>AREA_EPS)fragments.push(outside);
      remaining=halfPlane(remaining,b[i],b[(i+1)%b.length]);
    }
    return fragments;
  }
  function bounds(p) {return {minX:Math.min(...p.map(v=>v[0])),minY:Math.min(...p.map(v=>v[1])),maxX:Math.max(...p.map(v=>v[0])),maxY:Math.max(...p.map(v=>v[1]))};}
  function boxOverlap(a,b) {return a.minX<b.maxX-EPS&&a.maxX>b.minX+EPS&&a.minY<b.maxY-EPS&&a.maxY>b.minY+EPS;}
  function transform(p,rotation=0,flip=false,x=0,y=0) {
    const a=rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a),px=(p[0]-C.W/2)*(flip?-1:1),py=p[1]-C.H/2;
    return [x+px*c-py*s,y+px*s+py*c];
  }
  function orient(card,rotation=0,flip=false,x=0,y=0) {
    const tr=p=>transform(p,rotation,flip,x,y);
    const polygon=ccw([[0,0],[C.W,0],[C.W,C.H],[0,C.H]].map(tr));
    return {...card,x,y,rotation,flip,polygon,bounds:bounds(polygon),regions:card.regions.map(r=>({...r,polygon:ccw(r.polygon.map(tr)),dots:r.dots.map(tr)}))};
  }
  function equal(a,b) {return a.length===b.length&&a.every(p=>b.some(q=>Math.hypot(p[0]-q[0],p[1]-q[1])<.005));}
  function contains(poly,p) {return ccw(poly).every((a,i,arr)=>cross(a,arr[(i+1)%arr.length],p)>=-EPS);}
  const cache = new WeakMap();
  function context(state) {
    const old=cache.get(state);if(old&&old.length===state.board.length)return old;
    const board=state.board.map(c=>orient(c,c.rotation,c.flip,c.x,c.y));
    const surfaces=board.map((c,i)=>{
      let fragments=[c.polygon];
      for(let j=i+1;j<board.length;j++)if(boxOverlap(c.bounds,board[j].bounds))fragments=fragments.flatMap(p=>subtract(p,board[j].polygon));
      const available=c.regions.filter(r=>board.slice(i+1).every(top=>!boxOverlap(bounds(r.polygon),top.bounds)||area(intersect(r.polygon,top.polygon))<AREA_EPS));
      return {card:c,fragments,available};
    });
    const ctx={length:state.board.length,board,surfaces};cache.set(state,ctx);return ctx;
  }
  function inTable(state,card) {
    const t=state.table;return card.polygon.every(([x,y])=>x>=-t.width/2-EPS&&x<=t.width/2+EPS&&y>=-t.height/2-EPS&&y<=t.height/2+EPS);
  }
  function validate(state,card,rotation,flip,x,y,allowIsolated=false) {
    if(![rotation,x,y].every(Number.isFinite)||typeof flip!=='boolean')return {ok:false,reason:'无效坐标'};
    const placed=orient(card,rotation,flip,x,y);if(!inTable(state,placed))return {ok:false,reason:'卡牌不能越过桌边'};
    const ctx=context(state), touched=[];
    for(const surface of ctx.surfaces) {
      if(!boxOverlap(placed.bounds,surface.card.bounds))continue;
      const overlap=surface.fragments.reduce((n,p)=>n+area(intersect(p,placed.polygon)),0);
      if(overlap>AREA_EPS)touched.push({surface,overlap});
    }
    if(!touched.length) {
      if(!allowIsolated)return {ok:false,reason:'必须覆盖一个匹配形状'};
      // Independent placement must not even touch another printed outline.
      for(const c of ctx.board)if(!separated(placed.polygon,c.polygon,.25))return {ok:false,reason:'独立放置不能接触其他卡牌'};
      return {ok:true,isolated:true};
    }
    if(touched.length!==1)return {ok:false,reason:'不能同时覆盖两张牌的可见轮廓或图形'};
    const {surface,overlap}=touched[0];
    for(const target of surface.available)for(const source of placed.regions) {
      if(equal(source.polygon,target.polygon)&&Math.abs(overlap-area(target.polygon))<AREA_EPS) {
        return {ok:true,targetCard:surface.card.id,targetRegion:target.id,sourceRegion:source.id,covered:target.dots.length};
      }
    }
    return {ok:false,reason:'形状、尺寸或方向不匹配，或破坏了下层轮廓'};
  }
  function separated(a,b,gap=0) {
    for(const polygon of [a,b])for(let i=0;i<polygon.length;i++) {
      const p=polygon[i],q=polygon[(i+1)%polygon.length],nx=-(q[1]-p[1]),ny=q[0]-p[0],len=Math.hypot(nx,ny);
      const pa=a.map(v=>(v[0]*nx+v[1]*ny)/len),pb=b.map(v=>(v[0]*nx+v[1]*ny)/len);
      if(Math.max(...pa)+gap<Math.min(...pb)||Math.max(...pb)+gap<Math.min(...pa))return true;
    }
    return false;
  }
  function moves(state,card,rotation=0,flip=false,firstOnly=false) {
    const own=orient(card,rotation,flip),found=new Map();
    for(const surface of context(state).surfaces)for(const target of surface.available)for(const source of own.regions) {
      if(source.kind!==target.kind||Math.abs(area(source.polygon)-area(target.polygon))>AREA_EPS)continue;
      const a=center(source.polygon),b=center(target.polygon),x=b[0]-a[0],y=b[1]-a[1];
      if(!equal(source.polygon.map(p=>[p[0]+x,p[1]+y]),target.polygon))continue;
      const k=`${x.toFixed(4)},${y.toFixed(4)}`;if(found.has(k))continue;
      const result=validate(state,card,rotation,flip,x,y);
      if(result.ok){found.set(k,{x,y,...result});if(firstOnly)return [...found.values()];}
    }
    return [...found.values()];
  }
  function ends(state) {const d=state.decks[state.turn];return d.length>1?[d[0],d.at(-1)]:d;}
  function hasMove(state) {
    const ctx=context(state),signature=ends(state).map(c=>c.id).join('|');
    if(ctx.signature===signature)return ctx.hasMove;
    const result=ends(state).some(c=>Array.from({length:8},(_,i)=>i*45).some(r=>[false,true].some(f=>moves(state,c,r,f,true).length)));
    ctx.signature=signature;ctx.hasMove=result;return result;
  }
  function score(state) {
    const result=[0,0],board=context(state).board;
    board.forEach((c,i)=>{if(c.owner<0)return;for(const r of c.regions)for(const dot of r.dots)if(board.slice(i+1).every(top=>!contains(top.polygon,dot)))result[c.owner]++;});return result;
  }
  function deck(owner,random=Math.random) {
    const cards=C.cards.map((c,i)=>({...JSON.parse(JSON.stringify(c)),id:`${owner}-${i}`,owner}));
    for(let i=cards.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[cards[i],cards[j]]=[cards[j],cards[i]];}return cards;
  }
  function create(random=Math.random,table={width:1600,height:1100}) {
    const decks=[deck(0,random),deck(1,random)],rank=d=>Math.min(d[0].value,d.at(-1).value)*100+d[0].value+d.at(-1).value;
    const ranks=decks.map(rank),tie=ranks[0]===ranks[1];
    return {version:2,table:{...table},turn:tie?Math.floor(random()*2):ranks[0]<ranks[1]?0:1,starterTie:tie,decks,board:[{...C.starter(),x:0,y:0,rotation:0,flip:false}],finished:false};
  }
  function play(state,id,rotation,flip,x,y) {
    if(state.finished)throw Error('对局已结束');
    const card=ends(state).find(c=>c.id===id);if(!card)throw Error('只能打出牌堆两端的卡牌');
    const result=validate(state,card,rotation,flip,x,y,!hasMove(state));if(!result.ok)throw Error(result.reason);
    state.board.push({...card,x,y,rotation,flip});state.decks[state.turn]=state.decks[state.turn].filter(c=>c.id!==id);
    state.finished=state.decks.every(d=>!d.length);if(state.decks[1-state.turn].length)state.turn=1-state.turn;return result;
  }
  function restore(value) {
    if(!value||value.version!==2||![0,1].includes(value.turn)||!Array.isArray(value.decks)||value.decks.length!==2||!Array.isArray(value.board)||value.board.length<1)throw Error('存档格式无效');
    if(!Number.isFinite(value.table?.width)||!Number.isFinite(value.table?.height)||value.table.width<300||value.table.height<300)throw Error('桌面格式无效');
    const all=[...value.board,...value.decks.flat()];if(all.length!==37||new Set(all.map(c=>c.id)).size!==37)throw Error('牌组不完整');
    for(const c of all){if(!Array.isArray(c.regions)||!c.regions.length)throw Error('牌面无效');for(const r of c.regions)if(!Array.isArray(r.polygon)||r.polygon.length<3||!Array.isArray(r.dots)||[...r.polygon,...r.dots].some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)))throw Error('几何数据无效');}
    if(value.board.some(c=>![c.x,c.y,c.rotation].every(Number.isFinite)||typeof c.flip!=='boolean'))throw Error('落牌坐标无效');
    if(Boolean(value.finished)!==value.decks.every(d=>!d.length)||(!value.finished&&!value.decks[value.turn].length))throw Error('回合状态无效');
    return value;
  }
  const api={create,restore,deck,orient,moves,ends,hasMove,score,play,validate,context,area,intersect,subtract,equal,bounds,center,inTable,separated,dimensions:{width:C.W,height:C.H}};
  if(typeof module!=='undefined')module.exports=api;else root.Tacta=api;
})(typeof window==='undefined'?globalThis:window);
