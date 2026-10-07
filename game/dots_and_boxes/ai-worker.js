/* Persistent worker: time-sliced MCTS and resumable, bounded minimax proofs. */
function dotsWorkerMain(){
  const G=createDotsGame();
  let b,root,rootPlayer,tasks=[],total=0,nodes=0,cache=new Map(),pinned=new Set();
  let version=0,requestId=0,timer=null,outcomeCursor=0,marginCursor=0,proofVisits=0,dimensions='',proofTick=0,outcomeSteps=0,marginSteps=0;
  function rate(margin){return margin>0?1:margin<0?0:.5;}
  function choose(items){let ticket=Math.random()*items.reduce((n,c)=>n+c.weight,0);for(let i=0;i<items.length;i++){ticket-=items[i].weight;if(ticket<=0)return i;}return items.length-1;}
  function node(s,moves=[],prior=0){
    const policy=new Map(G.policy(b,s).map(p=>[p.edge,p.weight]));
    const untried=G.moveGroups(b,s).map(moves=>({moves,weight:policy.get(moves[0])}));
    const max=Math.max(1,...untried.map(c=>c.weight));untried.forEach(c=>c.prior=c.weight/max);
    return {s,moves,prior,n:0,w:0,marginSum:0,children:[],untried};
  }
  // Cache only FUTURE score differences for the player to move. Occupied-edge
  // geometry suffices: past ownership, scores and player colors are irrelevant.
  function entry(s,task){
    task.proofVisits++;proofVisits++;
    const key=G.canonical(b,s);let e=cache.get(key);if(e)return e;
    const remaining=b.boxes.length-s.scores[0]-s.scores[1];
    const solved=G.endgameInfo(b,s);
    e={lo:solved?solved.margin:-remaining,hi:solved?solved.margin:remaining,depth:0};
    if(cache.size>=60000){let removed=0;for(const k of cache.keys())if(!pinned.has(k)){cache.delete(k);if(++removed>=5000)break;}}
    cache.set(key,e);return e;
  }
  function childBounds(child){return child.same?{lo:child.gain+child.e.lo,hi:child.gain+child.e.hi}:{lo:child.gain-child.e.hi,hi:child.gain-child.e.lo};}
  // Every bound is rigorous. Depth cutoffs retain [-remaining,+remaining] or
  // previously proven tighter bounds, NEVER an MCTS estimate.
  function* prove(s,depth,task,alpha=-Infinity,beta=Infinity){
    const e=entry(s,task);yield;
    const windowKey=`${alpha}:${beta}`,full=alpha===-Infinity&&beta===Infinity;
    if(e.lo===e.hi||e.lo>=beta||e.hi<=alpha||depth<=e.depth||depth<=(e.windows?.get(windowKey)||0))return e;
    const weights=new Map(G.policy(b,s).map(p=>[p.edge,p.weight]));
    const moves=G.moveGroups(b,s).map(g=>g[0]).sort((a,z)=>weights.get(z)-weights.get(a));
    const children=[];
    for(const move of moves){
      const next=G.clone(s),gain=G.play(b,next,move);
      children.push({s:next,gain,same:next.turn===s.turn,e:entry(next,task)});yield;
    }
    function update(){
      if(!children.length)return;
      let lo=-Infinity,hi=-Infinity;
      for(const child of children){const bound=childBounds(child);lo=Math.max(lo,bound.lo);hi=Math.max(hi,bound.hi);}
      e.lo=Math.max(e.lo,lo);e.hi=Math.min(e.hi,hi);
    }
    update();
    for(const child of children){
      if(e.lo===e.hi||e.lo>=beta||e.hi<=alpha)break;
      // A child whose upper bound cannot beat the established lower bound
      // cannot change this max node's value.
      if(childBounds(child).hi<=e.lo)continue;
      const childAlpha=child.same?alpha-child.gain:child.gain-beta;
      const childBeta=child.same?beta-child.gain:child.gain-alpha;
      child.e=yield* prove(child.s,depth-1,task,childAlpha,childBeta);update();yield;
    }
    if(full)e.depth=Math.max(e.depth,depth);
    else {if(!e.windows)e.windows=new Map();if(e.windows.size>=4&&!e.windows.has(windowKey))e.windows.delete(e.windows.keys().next().value);e.windows.set(windowKey,Math.max(depth,e.windows.get(windowKey)||0));}
    return e;
  }
  function status(task){
    const base=task.s.scores[rootPlayer-1]-task.s.scores[2-rootPlayer];
    const same=task.s.turn===rootPlayer;
    const lo=base+(same?task.e.lo:-task.e.hi),hi=base+(same?task.e.hi:-task.e.lo);
    return {lo,hi,exact:lo===hi,outcome:lo>0?1:hi<0?0:lo===0&&hi===0?.5:null};
  }
  function proofStep(){
    const unknown=tasks.filter(t=>status(t).outcome===null);
    const refining=tasks.filter(t=>status(t).outcome!==null&&!status(t).exact);
    // Nine scheduling slots for unresolved outcomes, one for score refinement.
    // Unused slots go to the other lane. Completed outcome work is never repeated.
    const outcome=unknown.length>0&&(!refining.length||proofTick++%10!==9);
    const pool=outcome?unknown:refining;if(!pool.length)return false;
    const task=pool[(outcome?outcomeCursor++:marginCursor++)%pool.length],lane=outcome?'outcome':'margin';
    if(outcome)outcomeSteps++;else {marginSteps++;task.searches.outcome=null;}
    if(!task.searches[lane]){
      task.depths[lane]=Math.min(task.s.left,task.depths[lane]+2);
      let alpha=-Infinity,beta=Infinity;
      if(outcome){
        // Integer score: first ask whether total margin >= 1. If not, ask
        // whether it is >= 0 to distinguish a draw from a forced loss.
        const target=status(task).hi<=0?0:1;
        const base=task.s.scores[rootPlayer-1]-task.s.scores[2-rootPlayer];
        if(task.s.turn===rootPlayer){alpha=target-1-base;beta=target-base;}
        else {alpha=base-target;beta=base-target+1;}
      }
      task.searches[lane]=prove(task.s,task.depths[lane],task,alpha,beta);
    }
    const result=task.searches[lane].next();
    if(result.done){task.e=result.value;task.searches[lane]=null;}
    return true;
  }
  function rollout(s){
    while(s.left){
      let margin=G.endgameMargin(b,s);
      if(margin===null&&s.left<=16){const e=cache.get(G.canonical(b,s));if(e&&e.lo===e.hi)margin=s.scores[s.turn-1]-s.scores[2-s.turn]+e.lo;}
      if(margin!==null)return s.turn===rootPlayer?margin:-margin;
      const choices=G.policy(b,s);
      const k=Math.random()<.06?Math.floor(Math.random()*choices.length):choose(choices);
      G.play(b,s,choices[k].edge);
    }
    return s.scores[rootPlayer-1]-s.scores[2-rootPlayer];
  }
  function iteration(){
    root.untried=root.untried.filter(c=>!status(c.task).exact);
    const needsOutcome=tasks.some(t=>status(t).outcome===null);
    const eligible=c=>!status(c.task).exact&&(!needsOutcome||status(c.task).outcome===null);
    const available=n=>n===root?n.untried.filter(eligible):n.untried;
    let n=root;const path=[n];
    while((!available(n).length||nodes>=40000)&&n.children.length){
      const sign=n.s.turn===rootPlayer?1:-1;let best=-Infinity,pick;
      for(const c of n.children){
        if(n===root&&!eligible(c))continue;
        const score=sign*c.w/c.n+1.25*Math.sqrt(Math.log(n.n+1)/c.n)+.5*c.prior/(c.n+1);
        if(score>best){best=score;pick=c;}
      }
      if(!pick)return false;n=pick;path.push(n);
    }
    if(available(n).length&&nodes<40000){
      nodes++;const options=available(n),candidate=options[choose(options)],s=G.clone(n.s);n.untried.splice(n.untried.indexOf(candidate),1);G.play(b,s,candidate.moves[0]);
      const c=node(s,candidate.moves,candidate.prior);c.task=candidate.task;
      if(c.task)c.task.stats=c;n.children.push(c);n=c;path.push(n);
    }
    if(n===root)return false;
    const margin=rollout(G.clone(n.s)),r=rate(margin);
    for(const p of path){p.n++;p.w+=r;p.marginSum+=margin;}total++;return true;
  }
  function report(){
    let exactCount=0,provenCount=0;const results=[];
    for(const task of tasks){
      const bound=status(task),c=task.stats;
      if(bound.exact)exactCount+=task.moves.length;
      if(bound.outcome!==null)provenCount+=task.moves.length;
      if(!c?.n&&bound.outcome===null)continue;
      const mean=c?.n?c.marginSum/c.n:bound.lo>0?bound.lo:bound.hi;
      const margin=bound.exact?bound.lo:Math.max(bound.lo,Math.min(bound.hi,mean));
      for(const edge of task.moves)results.push({edge,n:(c?.n||0)+task.proofVisits,visits:c?.n||0,proofVisits:task.proofVisits,
        rate:bound.outcome??c.w/c.n,margin:margin||0,marginEstimated:!bound.exact,lower:bound.lo,upper:bound.hi,
        exact:bound.exact,outcomeProven:bound.outcome!==null,shared:task.moves.length});
    }
    const done=tasks.every(task=>status(task).exact);
    postMessage({id:requestId,total:total+proofVisits,simulations:total,proofVisits,outcomeSteps,marginSteps,done,exactCount,provenCount,results});return done;
  }
  onmessage=({data})=>{
    version++;clearTimeout(timer);timer=null;if(data.type==='pause')return;
    const current=version;requestId=data.id;
    const size=`${data.rows}x${data.cols}`;
    if(dimensions!==size){cache.clear();dimensions=size;}
    b=G.board(data.rows,data.cols);const s=G.replay(b,data.moves);rootPlayer=s.turn;
    total=0;proofVisits=0;nodes=1;outcomeCursor=0;marginCursor=0;proofTick=0;outcomeSteps=0;marginSteps=0;pinned=new Set();root=node(s);tasks=[];
    for(const candidate of root.untried){
      const next=G.clone(s);G.play(b,next,candidate.moves[0]);
      const task={moves:candidate.moves,s:next,depths:{outcome:0,margin:0},searches:{outcome:null,margin:null},stats:null,proofVisits:0};
      pinned.add(G.canonical(b,next));task.e=entry(next,task);candidate.task=task;tasks.push(task);
    }
    function batch(){
      if(current!==version)return;
      // Bounded scheduling quanta keep cancellation and new-position messages responsive.
      let until=performance.now()+10;while(performance.now()<until&&iteration()){}
      until=performance.now()+50;while(performance.now()<until&&proofStep()){}
      if(!report())timer=setTimeout(batch,8);
    }
    batch();
  };
}
