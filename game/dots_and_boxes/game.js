/* Shared, serializable rules for the page and analysis worker. */
function createDotsGame() {
  function board(rows, cols) {
    const edges = [], boxes = [], adjacent = [];
    for (let y=0;y<=rows;y++) for(let x=0;x<cols;x++) edges.push({x,y,h:true});
    const offset=edges.length;
    for(let y=0;y<rows;y++) for(let x=0;x<=cols;x++) edges.push({x,y,h:false});
    edges.forEach(()=>adjacent.push([]));
    for(let y=0;y<rows;y++) for(let x=0;x<cols;x++) {
      const ids=[y*cols+x,(y+1)*cols+x,offset+y*(cols+1)+x,offset+y*(cols+1)+x+1];
      const id=boxes.length; boxes.push(ids); ids.forEach(e=>adjacent[e].push(id));
    }
    const transforms=[(x,y)=>[x,y],(x,y)=>[cols-x,y],(x,y)=>[x,rows-y],(x,y)=>[cols-x,rows-y]];
    if(rows===cols)transforms.push((x,y)=>[y,x],(x,y)=>[cols-y,x],(x,y)=>[y,rows-x],(x,y)=>[cols-y,rows-x]);
    function edgeId(a,z){return a[1]===z[1]?a[1]*cols+Math.min(a[0],z[0]):offset+Math.min(a[1],z[1])*(cols+1)+a[0];}
    const symmetries=transforms.map(f=>edges.map(e=>edgeId(f(e.x,e.y),f(e.x+(e.h?1:0),e.y+(e.h?0:1)))));
    return {rows,cols,edges,boxes,adjacent,symmetries};
  }
  function initial(b){return {edges:new Uint8Array(b.edges.length),boxes:new Uint8Array(b.boxes.length),scores:[0,0],turn:1,left:b.edges.length};}
  function clone(s){return {edges:s.edges.slice(),boxes:s.boxes.slice(),scores:s.scores.slice(),turn:s.turn,left:s.left};}
  function play(b,s,e){
    if(!Number.isInteger(e)||e<0||e>=s.edges.length||s.edges[e]) throw Error('非法落子');
    const p=s.turn; s.edges[e]=p; s.left--; let gained=0;
    for(const box of b.adjacent[e]) if(!s.boxes[box]&&b.boxes[box].every(i=>s.edges[i])) {s.boxes[box]=p;s.scores[p-1]++;gained++;}
    if(!gained)s.turn=3-p;
    return gained;
  }
  function legal(s){const a=[];s.edges.forEach((v,i)=>{if(!v)a.push(i);});return a;}
  // Edge ownership has no effect on future legal moves or captures. Scores and
  // the player to move stay fixed while equivalent geometric moves are grouped.
  function moveGroups(b,s){
    const stable=b.symmetries.filter(map=>map.every((j,i)=>!!s.edges[i]===!!s.edges[j]));
    const seen=new Set(),groups=[];
    for(const e of legal(s))if(!seen.has(e)){
      const group=[...new Set(stable.map(map=>map[e]))];group.forEach(i=>seen.add(i));groups.push(group);
    }
    return groups;
  }
  function canonical(b,s){
    let best=null;
    for(const map of b.symmetries){const bits=new Array(s.edges.length);map.forEach((j,i)=>bits[j]=s.edges[i]?'1':'0');const key=bits.join('');if(best===null||key<best)best=key;}
    return best;
  }
  // Components in the dual graph: boxes connected through undrawn edges.
  function components(b,s){
    const missing=b.boxes.map(ids=>ids.filter(e=>!s.edges[e]));
    if(missing.some(ids=>ids.length>2))return null;
    const seen=new Set(),out=[];
    for(let start=0;start<missing.length;start++)if(missing[start].length&&!seen.has(start)){
      const boxes=[],stack=[start];seen.add(start);let boundary=0,tips=0;
      while(stack.length){const i=stack.pop();boxes.push(i);if(missing[i].length===1)tips++;
        for(const e of missing[i]){if(b.adjacent[e].length===1)boundary++;
          for(const j of b.adjacent[e])if(!seen.has(j)){seen.add(j);stack.push(j);}
        }
      }
      const length=boxes.length;
      if(tips===0&&boundary===2)out.push({type:'chain',length,boxes,open:false});
      else if(tips===0&&boundary===0)out.push({type:'loop',length,boxes,open:false});
      else if(tips===1&&boundary===1)out.push({type:'chain',length,boxes,open:true});
      else if(tips===2&&boundary===0)out.push({type:'loop',length,boxes,open:true});
      else return null;
    }
    return out;
  }
  const endCache=new Map();
  // Value is the controller's future margin over the player opening a component.
  function componentValue(parts,budget={n:0}){
    if(++budget.n>4000)throw Error('endgame budget');
    if(!parts.length)return 0;
    const key=parts.map(c=>(c.type==='chain'?'c':'l')+c.length).sort().join(',');
    if(endCache.has(key))return endCache.get(key);
    let best=Infinity;const tried=new Set();
    for(let i=0;i<parts.length;i++){
      const c=parts[i],signature=c.type+c.length;if(tried.has(signature))continue;tried.add(signature);
      const rest=parts.slice();rest.splice(i,1);const k=c.type==='chain'?2:4;
      best=Math.min(best,c.length-k+Math.abs(componentValue(rest,budget)-k));
    }
    if(endCache.size>20000)endCache.clear();endCache.set(key,best);return best;
  }
  function endgameInfo(b,s){
    const parts=components(b,s);if(!parts)return null;
    const opened=parts.filter(c=>c.open),closed=parts.filter(c=>!c.open);
    if(opened.length>1||closed.some(c=>c.length<(c.type==='chain'?3:4)))return null;
    try{
      const v=componentValue(closed);
      if(!opened.length)return {margin:-v,parts};
      const c=opened[0],k=c.type==='chain'?2:4;
      const keep=c.length>=k&&v>k;
      return {margin:Math.max(c.length-v,c.length>=k?c.length-2*k+v:-Infinity),parts,opened:c,keep,k};
    }catch{return null;}
  }
  function endgameMargin(b,s){const info=endgameInfo(b,s);return info?s.scores[s.turn-1]-s.scores[2-s.turn]+info.margin:null;}
  function policy(b,s){
    const moves=legal(s),missing=b.boxes.map(ids=>ids.reduce((n,e)=>n+!s.edges[e],0));
    const groups=new Int32Array(b.boxes.length).fill(-1),sizes=[];
    // Opening a degree-two corridor gives away its whole connected run.
    for(let i=0;i<missing.length;i++)if(missing[i]===2&&groups[i]<0){
      const id=sizes.length,stack=[i];groups[i]=id;let size=0;
      while(stack.length){const box=stack.pop();size++;
        for(const e of b.boxes[box])if(!s.edges[e])for(const next of b.adjacent[e])if(missing[next]===2&&groups[next]<0){groups[next]=id;stack.push(next);}
      }sizes.push(size);
    }
    const info=endgameInfo(b,s),capture=moves.some(e=>b.adjacent[e].some(i=>missing[i]===1));
    const safe=moves.some(e=>b.adjacent[e].every(i=>missing[i]>=3));
    return moves.map(edge=>{
      const adjacent=b.adjacent[edge],gain=adjacent.filter(i=>missing[i]===1).length;
      const ids=new Set(adjacent.filter(i=>missing[i]===2).map(i=>groups[i]));
      const cost=[...ids].reduce((sum,id)=>sum+sizes[id],0);
      let weight;
      if(gain)weight=20*gain;
      else if(cost===0){
        // Penalize safe moves which extend or join existing vulnerable corridors.
        const touching=new Set();
        for(const i of adjacent)if(missing[i]===3)for(const e of b.boxes[i])if(!s.edges[e]&&e!==edge)for(const j of b.adjacent[e])if(groups[j]>=0)touching.add(groups[j]);
        const pressure=[...touching].reduce((sum,id)=>sum+sizes[id],0);
        weight=(capture?.3:8)/(1+.25*pressure);
      }else weight=(capture||safe?.03:1)/(cost*cost);
      // At the handout point, intentionally play a non-scoring edge: two boxes
      // for an open chain, four for a broken loop. Otherwise continue collecting.
      if(info?.keep&&info.opened.length===info.k&&!gain){
        const boxes=new Set(info.opened.boxes);
        if(adjacent.every(i=>boxes.has(i))&&((info.k===2&&adjacent.length===1)||(info.k===4&&adjacent.length===2)))weight=80;
      }
      return {edge,weight};
    });
  }
  function replay(b,moves){const s=initial(b);moves.forEach(e=>play(b,s,e));return s;}
  return {board,initial,clone,play,legal,replay,moveGroups,canonical,components,componentValue,endgameInfo,endgameMargin,policy};
}
if(typeof module!=='undefined')module.exports=createDotsGame;
