/* Chinese mechanical summaries, with executable effects below. No card artwork. */
(function(r){
const zh=[
['粉碎家园','1 恐惧；摧毁 1 城镇。'],['狂暴风雨','对每个入侵者造成 1 伤害。'],['闪电恩赐','目标精灵本轮可将 2 个慢速能力作为快速使用。'],['雷霆先兆','推移至多 2 达汉；若有达汉进入有建筑的土地，产生 1 恐惧。'],
['山洪暴发','1 伤害；沿海额外 1 伤害。'],['冲刷殆尽','推移至多 3 探索者／城镇。'],['活力恩赐','目标是自己：获得 1 能量；目标是同伴：按其本轮已出牌数获得能量。'],['河流的馈赠','聚集至多 2 达汉；随后若至少有 2 达汉，增加 1 达汉并获得 1 能量。'],
['隐匿暗影','1 恐惧；本轮蹂躏不对达汉造成伤害。'],['偿还恩情','聚集至多 4 达汉；若达汉多于入侵者且有入侵者，产生 3 恐惧。'],['恐惧斗篷','2 恐惧；目标精灵可从一个有自身灵迹的土地推移 1 探索者和 1 城镇。'],['作物枯萎消散','2 恐惧；将 1 城市替换为城镇，或 1 城镇替换为探索者。'],
['守护疗愈之地','移除 1 枯萎；防御 4。'],['整年安宁','目标土地本轮跳过所有入侵者行动。'],['毁灭仪式','2 伤害；若至少 3 达汉，额外 3 伤害和 2 恐惧。'],['沃土的召唤','聚集至多 2 探索者，再聚集至多 2 达汉。'],
['凶猛巨兽','丛林／湿地：1 恐惧和 1 伤害。3 兽：再造成 1 伤害。'],['贪婪生长','造成 2 伤害，或移除 1 枯萎。'],['唤醒树木山石','2 伤害；推移 1 探索者。'],['全面护佑','目标精灵的所有灵迹土地获得防御 2。'],['圣洁之歌','若有探索者，推移所有探索者；否则移除 1 枯萎。'],['诡异消融','若有入侵者，1 恐惧；沙地／湿地移除 1 枯萎。'],['燃林之影','2 恐惧；山地／丛林再推移 1 探索者和 1 城镇。'],['蒸汽喷口','摧毁 1 探索者；3 土：可改为摧毁 1 城镇。'],['夜猎之幕','每个达汉对不同入侵者造成 1 伤害，或推移至多 3 达汉。'],['元素恩赐','目标选择 3 个不同元素；若目标是同伴，你也获得这些元素。'],
['吞噬蚁群','1 恐惧，1 伤害，摧毁 1 达汉；丛林／沙地再加 1 伤害。'],['幽暗密林','2 恐惧；山地／丛林获得防御 3。'],['削弱众生','防御 5；1 风：距离增加 1。'],['沉入梦乡','防御 1；丛林／沙地改为防御 4。'],['余烬鬼域','2 恐惧，推移至多 2 探索者／城镇；若已有枯萎，额外 2 恐惧且可再推移 2；最后增加 1 枯萎。'],['自然韧性','防御 6；2 水：可改为移除 1 枯萎。'],['烈焰末日幻象','1 恐惧，推移 1 探索者／城镇；2 火：额外 1 恐惧。'],['饥饿大地','若有己方灵迹，1 恐惧与 1 伤害；沙地／湿地再加 1 伤害。'],['达汉之道','探索者替换为达汉；2 月：可改为把城镇替换为达汉。'],['血战召唤','每个达汉造成 1 伤害，或聚集至多 3 达汉。'],['隔离召唤','每个达汉可推移 1 探索者／城镇，或推移 1 达汉。'],['迁徙召唤','聚集至多 3 达汉，再推移至多 3 达汉。'],['照料召唤','移除 1 枯萎，或推移至多 3 达汉。'],['加剧大地挣扎','对每个建筑造成 1 伤害，或防御 10。'],['危险妄想','推移 1 探索者，或 2 恐惧。'],['干旱','摧毁 3 城镇；对每个建筑造成 1 伤害；增加 1 枯萎。3 日：摧毁 1 城市。'],['恒常恩赐','目标获得 2 能量；回合末可收回 1 张本轮牌。若目标是同伴，你也可如此收回 1 张。'],['诱人光彩','聚集 1 探索者／城镇，或聚集至多 2 达汉。'],['迷魂幻影','防御 2；若无入侵者，聚集至多 2 探索者。'],['生命能量恩赐','目标获得 1 能量，同伴额外 1；你至少有 2 圣地时，再额外 1。'],['能力恩赐','目标精灵获取 1 张次要能力。'],['啃根者','推移至多 2 城镇。'],['未知诱惑','聚集 1 探索者／城镇。'],['净化火焰','每个枯萎造成 1 伤害；山地／沙地可改为移除 1 枯萎。'],['血雨','2 恐惧；至少 2 建筑时再加 1。'],['延展之握','目标精灵本轮所有能力距离 +2。'],
['加速腐败','2 恐惧，4 伤害。3 日 2 水 3 木：再加 5 伤害并移除 1 枯萎。'],['净化洪流','4 伤害并移除 1 枯萎；4 水：再加 10 伤害。'],['活焰之柱','3 恐惧，5 伤害；丛林／湿地加入 1 枯萎。4 火：额外 2 恐惧和 5 伤害。'],['剧毒土地','1 恐惧，7 伤害；加入 1 枯萎并摧毁所有达汉。3 土 2 木 2 兽：随后每个枯萎产生 1 恐惧和 4 伤害。'],['骇人梦魇','2 恐惧，推移至多 4 探索者／城镇；4 月：额外 4 恐惧。'],['树石诉说战争','每个达汉造成 1 伤害并提供防御 2。2 日 2 土 2 木：可推移至多 2 达汉，其防御随之移动。'],['交织的力量','双方可借用彼此灵迹指定目标；同伴获取能力，你从其未保留的牌中选一张。2 水 4 木：双方各得 3 能量，并可交换一张手牌。'],['麻痹恐惧','4 恐惧；本轮跳过目标土地全部入侵行动。2 风 3 土：额外 4 恐惧。'],['能力风暴','目标获得 3 能量，可付费重复 1 张能力牌。2 日 2 火 3 风：可再重复 2 张不同能力牌。'],['闪电利爪','3 恐惧，5 伤害。3 火 3 风：距离改为 3，并在每个相邻土地摧毁 1 城镇。'],['饥饿丛林','摧毁全部探索者、城镇与达汉。2 月 3 木：额外摧毁 1 城市，且不摧毁达汉。'],['大地痛苦翻腾','每个目标土地枯萎造成 2 伤害，每个相邻枯萎再加 1。3 月 3 土：可在相邻土地重复。'],['海啸','2 恐惧，8 伤害，摧毁 2 达汉。3 水 2 土：同岛板其余沿海土地各 1 恐惧、4 伤害并摧毁 1 达汉。'],['破晓活力','每个达汉造成 2 伤害。3 日 2 兽：可推移至多 2 达汉，并在移入土地按移入达汉数各造成 2 伤害。'],['死者复仇','3 恐惧；本轮每次效果摧毁目标土地的建筑／达汉后，按摧毁数造成伤害。3 兽：该伤害可以分配至相邻土地。'],['日光之翼','将至多 5 达汉移至任意一个土地，那里防御 5。2 日 2 风 2 兽：先聚集至多 3 达汉。'],['炽焰新生','目标精灵将 2 个被摧毁灵迹放回你距离 2 内的同一土地；若成功，对那里的每个建筑造成 2 伤害。3 火 3 土 2 木：再造成 4 伤害。'],['锈蚀衰弱之风','1 恐惧、防御 6，降级 1 城市或城镇。3 风 3 水 2 兽：重复此能力。'],['不屈宣告','在目标土地增加 1 灵迹；防御 20。2 日 3 土：若有入侵者则 3 恐惧，并跳过本轮入侵行动。'],['遗忘迷雾','每个入侵者受到 1 伤害；每摧毁 1 建筑额外 1 恐惧，最多 4。2 月 3 风 2 水：再造成 3 伤害。'],['无尽生命','达汉在此地生命 +4；本轮阻止此地加入枯萎。4 土：达汉免疫伤害与摧毁，并移除目标或相邻土地的 1 枯萎。'],['瓦解亲缘','将 1 城市换成 2 探索者，1 城镇换成 1 探索者，1 达汉换成 1 探索者；探索者尽可能分散推移。2 火 2 水 3 兽：推移前，探索者与建筑互相攻击。']
];
// All included powers are resolved by the queue engine.
const assisted=[];
function effects(id,s,p,l,t){const E=r.SpiritGame;const e=E.elements(s,p),a=(k,n)=>e[k]>=n,has=o=>Object.entries(o).every(([k,n])=>a(k,n));const land=s.lands[l],d=land?.dahan.length||0,b=land?.blight||0,units=land?.units||[],terrain=land?.terrain;const ops=[];const add=(type,n,extra={})=>ops.push({type,n,p,land:l,...extra});const fear=n=>add('fear',n),dmg=(n,extra)=>add('damage',n,extra),def=n=>add('defend',n),clean=()=>add('clean',1),push=(n,kinds='et',extra={})=>add('move',n,{kinds,mode:'push',...extra}),gather=(n,kinds='d')=>add('move',n,{kinds,mode:'gather'}),destroy=(n,kinds='etc',extra={})=>add('destroy',n,{kinds,...extra}),choice=(label,choices)=>add('choice',0,{label,choices}),choose=(label,op)=>({label,ops:[op]}),op=(type,n,extra={})=>({type,n,p,land:l,...extra});
 if(assisted.includes(id)){add('assisted',0,{card:id});return ops;}
 switch(id){
 case 0:fear(1);destroy(1,'t');break;case 1:dmg(1,{each:true});break;case 2:add('boon',2,{target:t});break;case 3:push(2,'d',{harbinger:true});break;
 case 4:dmg(land.coast?2:1);break;case 5:push(3);break;case 6:add('energy',t===p?1:s.players[t].played.length,{target:t});break;case 7:gather(2);add('bounty',0);break;
 case 8:fear(1);add('flag',0,{flag:'conceal'});break;case 9:gather(4);add('favors',0);break;case 10:fear(2);add('landChoice',0,{target:t,filter:'presence',ops:[op('move',1,{kinds:'e',mode:'push'}),op('move',1,{kinds:'t',mode:'push'})]});break;case 11:fear(2);add('replace',1,{kinds:'tc',to:'downgrade'});break;
 case 12:clean();def(4);break;case 13:add('flag',0,{flag:'skip'});break;case 14:dmg(d>=3?5:2);if(d>=3)fear(2);break;case 15:gather(2,'e');gather(2);break;
 case 16:if([1,2].includes(terrain)){fear(1);dmg(1);}if(a('animal',3))dmg(1);break;
 case 17:choice('选择能力效果',[choose('造成 2 伤害',op('damage',2)),choose('移除枯萎',op('clean',1))]);break;
 case 18:dmg(2);push(1,'e');break;case 19:add('ward',2,{target:t});break;case 20:if(units.some(u=>u.type==='e'))push(99,'e');else clean();break;
 case 21:if(units.length)fear(1);if([1,3].includes(terrain))clean();break;case 22:fear(2);if([0,2].includes(terrain)){push(1,'e');push(1,'t');}break;
 case 23:destroy(1,a('earth',3)?'et':'e');break;case 24:choice('选择能力效果',[choose('每个达汉伤害不同入侵者',op('damage',d,{distinct:true})),choose('推移至多 3 达汉',op('move',3,{mode:'push',kinds:'d'}))]);break;
 case 25:add('elements',3,{target:t,chosen:[]});break;case 26:fear(1);dmg([2,3].includes(terrain)?2:1);destroy(1,'d');break;case 27:fear(2);if([0,2].includes(terrain))def(3);break;case 28:def(5);break;case 29:def([2,3].includes(terrain)?4:1);break;
 case 30:fear(b?4:2);push(b?4:2);add('blight',1);break;case 31:if(a('water',2))choice('选择能力效果',[choose('防御 6',op('defend',6)),choose('移除枯萎',op('clean',1))]);else def(6);break;
 case 32:fear(a('fire',2)?2:1);push(1);break;case 33:if(land.presence[p])fear(1);dmg((land.presence[p]?1:0)+([1,3].includes(terrain)?1:0));break;case 34:add('replace',1,{kinds:a('moon',2)?'et':'e',to:'d'});break;
 case 35:choice('选择能力效果',[choose('每个达汉 1 伤害',op('damage',d)),choose('聚集至多 3 达汉',op('move',3,{mode:'gather',kinds:'d'}))]);break;
 case 36:choice('选择能力效果',[choose('按达汉数推移入侵者',op('move',d,{mode:'push',kinds:'et'})),choose('推移 1 达汉',op('move',1,{mode:'push',kinds:'d'}))]);break;
 case 37:gather(3);push(3,'d');break;case 38:choice('选择能力效果',[choose('移除枯萎',op('clean',1)),choose('推移至多 3 达汉',op('move',3,{mode:'push',kinds:'d'}))]);break;
 case 39:choice('选择能力效果',[choose('每个建筑 1 伤害',op('damage',1,{each:true,kinds:'tc'})),choose('防御 10',op('defend',10))]);break;
 case 40:choice('选择能力效果',[choose('推移探索者',op('move',1,{mode:'push',kinds:'e'})),choose('产生 2 恐惧',op('fear',2))]);break;
 case 41:destroy(3,'t');dmg(1,{each:true,kinds:'tc'});add('blight',1);if(a('sun',3))destroy(1,'c');break;
 case 42:add('energy',2,{target:t});add('constancy',1,{target:t});if(t!==p)add('constancy',1,{target:p});break;
 case 43:choice('选择能力效果',[choose('聚集探索者／城镇',op('move',1,{mode:'gather',kinds:'et'})),choose('聚集达汉',op('move',2,{mode:'gather',kinds:'d'}))]);break;
 case 44:def(2);if(!units.length)gather(2,'e');break;case 45:add('energy',1+(t!==p?1:0)+(s.lands.filter(x=>E.sacred(s,p,x.id)).length>=2?1:0),{target:t});break;
 case 46:add('gain',0,{p:t,deck:'Minor'});break;case 47:push(2,'t');break;case 48:gather(1,'et');break;
 case 49:if([0,3].includes(terrain))choice('选择能力效果',[choose('按枯萎数造成伤害',op('damage',b)),choose('移除枯萎',op('clean',1))]);else dmg(b);break;
 case 50:fear(units.filter(u=>u.type!=='e').length>=2?3:2);break;case 51:add('range',2,{target:t});break;
 case 52:{const yes=has({sun:3,water:2,plant:3});fear(2);dmg(yes?9:4);if(yes)clean();break;}
 case 53:dmg(a('water',4)?14:4);clean();break;case 54:fear(a('fire',4)?5:3);dmg(a('fire',4)?10:5);if([1,2].includes(terrain))add('blight',1);break;
 case 55:fear(1);dmg(7);add('blight',1);destroy(99,'d');if(has({earth:3,plant:2,animal:2}))add('poison',0);break;
 case 56:fear(a('moon',4)?6:2);push(4);break;case 57:dmg(d);def(2*d);if(has({sun:2,earth:2,plant:2}))push(2,'d',{carryDefend:2});break;
 case 58:add('entwine',0,{target:t});add('gain',0,{p:t,share:p});if(has({water:2,plant:4})){add('energy',3,{target:p});add('energy',3,{target:t});add('gift',0);add('gift',0,{p:t});}break;
 case 59:fear(has({air:2,earth:3})?8:4);add('flag',0,{flag:'skip'});break;
 case 60:add('energy',3,{target:t});add('repeatGrant',has({sun:2,fire:2,air:3})?3:1,{target:t,paid:true,max:99});break;
 case 61:fear(3);dmg(5);if(has({fire:3,air:3}))E.adj(l,s).forEach(i=>add('destroy',1,{land:i,kinds:'t'}));break;
 case 62:destroy(99,'et');if(has({moon:2,plant:3}))destroy(1,'c');else destroy(99,'d');break;
 case 63:dmg(b*2+E.adj(l,s).reduce((n,i)=>n+s.lands[i].blight,0));if(has({moon:3,earth:3}))add('landChoice',0,{ids:E.adj(l,s),ops:[op('thrash',0)]});break;
 case 64:fear(2);dmg(8);destroy(2,'d');if(has({water:3,earth:2}))s.lands.filter(x=>x.board===land.board&&x.coast&&x.id!==l).forEach(x=>{add('fear',1);add('damage',4,{land:x.id});add('destroy',1,{land:x.id,kinds:'d'});});break;
 case 65:dmg(2*d);if(has({sun:3,animal:2}))push(2,'d',{arrivalDamage:2});break;
 case 66:fear(3);add('vengeance',0,{adjacent:a('animal',3)});break;
 case 67:if(has({sun:2,air:2,animal:2}))gather(3);add('fly',5);break;
 case 68:add('restore',0,{p:t,source:p,threshold:has({fire:3,earth:3,plant:2})});break;
 case 69:fear(1);def(6);add('replace',1,{kinds:'tc',to:'downgrade'});if(has({air:3,water:3,animal:2}))add('repeatPower',0,{card:id});break;
 case 70:add('presence',1,{range:99,fixed:l});def(20);if(has({sun:2,earth:3})){if(units.length)fear(3);add('flag',0,{flag:'skip'});}break;
 case 71:{const bonusGroup=s.uid++;dmg(1,{each:true,bonusBuilding:true,bonusGroup});if(has({moon:2,air:3,water:2}))dmg(3,{bonusBuilding:true,bonusGroup});break;}
 case 73:add('replace',1,{kinds:'c',to:'e',count:2});add('replace',1,{kinds:'t',to:'e'});add('replace',1,{kinds:'d',to:'e'});if(has({fire:2,water:2,animal:3}))add('kinshipFight',0);push(99,'e',{mandatory:true,spread:true});break;
 case 72:add('flag',0,{flag:'vitality'});if(a('earth',4)){add('flag',0,{flag:'immortal'});add('landChoice',0,{ids:[l,...E.adj(l,s)],ops:[op('clean',1)]});}break;
 }
 return ops;
}
r.SIPowers={zh,assisted,effects};if(typeof module!=='undefined')module.exports=r.SIPowers;
})(typeof window!=='undefined'?window:globalThis);
