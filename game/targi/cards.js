/* 基础版卡牌数据。资源顺序：椰枣、盐、胡椒、黄金。
 * 编号为本项目检索编号，不是实体卡编号。数据来源见 RULES.md。
 */
(function (root) {
  'use strict';
  const types = ['水井', '骆驼骑手', '绿洲', '塔尔吉娅', '营地'];
  const rows = [
    // type, cost(s), points, ability, argument
    [0,[1,2,0,0],1,'discount',0],
    [0,[1,0,0,1],1,'storedGold'],
    [0,[1,0,0,1],1,'robber'],
    [0,[0,1,0,1],1,'pairs',3],
    [0,[0,1,1,1],2,'freeHand'],
    [0,[1,2,1,0],2,'builtGoods'],
    [0,[2,1,1,0],2,'none'],
    [0,[2,1,2,0],3,'none'],
    [0,[1,1,0,1],3,'none'],
    [1,[0,0,0,1],1,'discount',1],
    [1,[0,0,0,1],1,'majority'],
    [1,[2,1,0,0],1,'emptyGoods'],
    [1,[0,1,0,1],1,'pairs',4],
    [1,[2,2,1,0],2,'rightmost'],
    [1,[0,0,2,1],2,'production',2],
    [1,[1,2,1,0],2,'none'],
    [1,[1,2,2,0],3,'none'],
    [1,[1,1,0,1],3,'none'],
    [2,[0,2,1,0],1,'discount',2],
    [2,[0,0,1,1],1,'pairs',0],
    [2,[0,1,1,1],1,'raidImmune'],
    [2,[0,2,1,0],1,'production',1],
    [2,[0,1,1,1],2,'rearrange'],
    [2,[1,0,1,1],2,'noGoods'],
    [2,[0,0,1,1],2,'none'],
    [2,[1,1,0,1],3,'none'],
    [2,[2,1,2,0],3,'none'],
    [3,[0,0,2,1],1,'diversity'],
    [3,[[1,2,0,0],[0,0,0,1]],1,'discount',3],
    [3,[1,0,0,1],1,'raidReward'],
    [3,[0,0,1,1],1,'pairs',1],
    [3,[1,1,2,0],2,'choiceBonus'],
    [3,[2,0,0,1],2,'production',0],
    [3,[1,1,2,0],2,'none'],
    [3,[1,2,2,0],3,'none'],
    [3,[1,0,1,1],3,'none'],
    [4,[[1,0,2,0],[0,0,0,1]],1,'discount',4],
    [4,[1,0,0,1],1,'trade'],
    [4,[1,0,1,0],1,'ten'],
    [4,[1,0,0,1],1,'pairs',2],
    [4,[1,1,2,0],2,'block'],
    [4,[1,0,0,1],2,'nobleDiscount'],
    [4,[0,0,1,1],2,'none'],
    [4,[1,0,1,1],3,'none'],
    [4,[2,2,1,0],3,'none'],
  ];
  const tribes = rows.map(([type,cost,vp,effect,arg],i)=>({kind:'tribe', id:`T${String(i+1).padStart(2,'0')}`,type,costs:Array.isArray(cost[0])?cost:[cost],vp,effect,arg}));
  const goods=[];
  function good(gain){goods.push({kind:'goods',id:`G${String(goods.length+1).padStart(2,'0')}`,gain});}
  for(let i=0;i<3;i++){good([[i,1]]);good([[i,1]]);good([[i,2]]);}
  good([[0,1],[1,1]]);good([[0,1],[2,1]]);good([[1,1],[2,1]]);
  for(let i=0;i<3;i++)good([]);
  for(let i=0;i<3;i++)good([[3,1]]);
  good([[4,1]]);
  const data={types,tribes,goods};
  if(typeof module!=='undefined'&&module.exports)module.exports=data;
  else root.TargiCards=data;
})(typeof globalThis!=='undefined'?globalThis:this);
