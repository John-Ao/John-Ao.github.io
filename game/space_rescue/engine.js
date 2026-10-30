/* Pure game rules; coordinates are row-major on a 7 × 7 board. */
const Rescue = (() => {
  const directions = [[0,-1],[1,0],[0,1],[-1,0]];
  function destination(pieces,index,direction) {
    if (!Number.isInteger(index) || !pieces[index] && pieces[index] !== 0 || !directions[direction]) return null;
    const [dx,dy]=directions[direction], x=pieces[index]%7, y=Math.floor(pieces[index]/7);
    let distance=Infinity;
    pieces.forEach((p,i)=>{
      if(i===index)return;
      const a=p%7-x,b=Math.floor(p/7)-y;
      if((dx===0&&a===0&&b*dy>0)||(dy===0&&b===0&&a*dx>0)) distance=Math.min(distance,Math.abs(a)+Math.abs(b));
    });
    return !Number.isFinite(distance)||distance===1 ? null : x+dx*(distance-1)+7*(y+dy*(distance-1));
  }
  function move(pieces,index,direction) {
    const to=destination(pieces,index,direction);
    if(to===null)return null;
    const result=pieces.slice();result[index]=to;return result;
  }
  function solve(start,limit=150000) {
    const key=p=>p[0]+':'+p.slice(1).sort((a,b)=>a-b).join(',');
    const nodes=[{p:start,parent:-1}], seen=new Set([key(start)]);
    for(let head=0;head<nodes.length;head++) {
      const n=nodes[head];
      if(n.p[0]===24) {
        const path=[];let j=head;
        while(nodes[j].parent!==-1){path.push(nodes[j].action);j=nodes[j].parent;}
        return path.reverse();
      }
      if(nodes.length>limit)return undefined;
      for(let i=0;i<start.length;i++)for(let d=0;d<4;d++){
        const p=move(n.p,i,d);if(!p)continue;const k=key(p);
        if(!seen.has(k)){seen.add(k);nodes.push({p,parent:head,action:[i,d]});}
      }
    }
    return null;
  }
  return {destination,move,solve};
})();
if(typeof module!=='undefined')module.exports=Rescue;
