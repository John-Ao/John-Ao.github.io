import * as E from './model.mjs';
const check=ok=>{if(!ok)throw Error('非法游戏操作');};
export const adapter={id:'lost_cities',create:()=>E.fresh('local'),actor:s=>s.player,ended:s=>['round','end'].includes(s.phase),
 act(s,a){check(a&&['play','draw'].includes(a.name)&&Array.isArray(a.args));check(E[a.name](s,...a.args)!==false);return s;},
 canAgree:(s,op)=>op==='next'&&s.phase==='round',agree(s,op){check(op==='next'&&s.phase==='round');E.nextRound(s);return s;}};
