/* Pure permutation model; clockwise slot indices follow SVG's positive y axis. */
(function(root){
  const exchanges=[[0,4],[0,0],[1,6],[1,2],[2,0],[2,4],[3,2],[3,6]];
  const mod=(n,m)=>((n%m)+m)%m;
  function solvedState(){return Array.from({length:4},(_,r)=>Array.from({length:8},(_,i)=>({id:r*8+i,color:r})));}
  function rotate(state,ring,steps){
    const out=state.map(row=>row.slice());
    if(ring===4)exchanges.forEach(([r,s],i)=>{const [nr,ns]=exchanges[mod(i+steps,8)];out[nr][ns]=state[r][s];});
    else state[ring].forEach((bead,i)=>{out[ring][mod(i+steps,8)]=bead;});
    return out;
  }
  function isSolved(state){return state.every(row=>row.every(b=>b.color===row[0].color));}
  const api={exchanges,mod,solvedState,rotate,isSolved};
  if(typeof module!=="undefined")module.exports=api;else root.Puzzle=api;
})(globalThis);
