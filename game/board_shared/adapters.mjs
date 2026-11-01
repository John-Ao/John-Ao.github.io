const check = (ok) => { if (!ok) throw Error('非法游戏操作'); };
export function objectAdapter(id, engine) {
  const E = {...engine};
  const names = id === 'toy_battle' ? ['place','choose','select','base','effect','skip','recruit'] : id === 'schotten_totten' ? ['play','claim','end','pass','beginPlay','recruitDraw','recruitReturn'] : ['draft','action','choose','starter','invoke','trigger'];
  return {
    id, names,
    create(options) {
      check(options && typeof options === 'object');
      if (id === 'toy_battle') { check(E.maps.some(m=>m.id===options.mapId) && typeof options.basic==='boolean'); return E.create(options); }
      if (id === 'schotten_totten') { check(Number.isInteger(options.rounds)&&options.rounds>=1&&options.rounds<=99&&[0,1].includes(options.first)&&typeof options.tactics==='boolean'&&typeof options.expert==='boolean'); return E.create(options); }
      check([0,1].includes(options.first) && typeof options.config?.pantheon==='boolean' && typeof options.config?.agora==='boolean');
      return E.create(options.first,options.config);
    },
    actor:s=>id==='toy_battle'?s.turn:id==='schotten_totten'?s.player:(s.pending?.who??s.turn),
    ended:s=>id==='toy_battle'?s.winner!==null:id==='schotten_totten'?E.finished(s):s.phase==='end',
    act(s,a) { check(a && names.includes(a.name) && Array.isArray(a.args)); const result=E[a.name](s,...a.args); check(result!==false); return s; },
    canAgree:(s,op)=>id==='schotten_totten'&&(op==='next'?E.finished(s)&&s.round<s.options.rounds:op==='draw'&&s.stalled&&!E.finished(s)),
    agree(s,op,a) { if(op==='next'){check([0,1].includes(a?.first));const next=E.nextRound(s,a.first);check(next);return next;} check(op==='draw'&&E.agreeDraw(s));return s; }
  };
}
export function radlandsAdapter(Game) {
  const names=['flip','draft','choose','buy','end','play','junk','use'];
  const methods=Object.fromEntries(names.map(n=>[n,Game.prototype[n]]));
  return {id:'radlands',names,create(o){check(['classic','revised','complete'].includes(o?.mode)&&['draft','starter'].includes(o?.setup));return new Game(null,o.mode,o.setup).s;},actor:s=>s.phase==='draft'?Math.min(s.draft,1):(s.choice?.p??s.active),ended:s=>s.phase==='over',act(s,a){check(a&&names.includes(a.name)&&Array.isArray(a.args));const g=new Game(s);if(!['draft','choose'].includes(a.name))check(a.args[0]===s.active);check(methods[a.name].apply(g,a.args)!==false);return g.s;}};
}
