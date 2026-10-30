/* Base game values transcribed from the publisher's rulebook, pp. 14–20. */
const CARDS=[];
function card(age,name,color,cost='',effect={},chain=''){CARDS.push({id:CARDS.length,age,name,color,cost,...effect,chain});}
card(1,'伐木场','brown','',{res:'w'});card(1,'林场','brown','1',{res:'w'});card(1,'黏土池','brown','',{res:'c'});card(1,'黏土坑','brown','1',{res:'c'});card(1,'采石场','brown','',{res:'s'});card(1,'石坑','brown','1',{res:'s'});card(1,'玻璃工坊','gray','1',{res:'g'});card(1,'压纸坊','gray','1',{res:'p'});
card(1,'瞭望塔','red','',{shield:1});card(1,'马厩','red','w',{shield:1});card(1,'驻军营','red','c',{shield:1});card(1,'栅栏','red','2',{shield:1});
card(1,'工坊','green','p',{science:'△',vp:1});card(1,'药房','green','g',{science:'☸',vp:1});card(1,'抄写室','green','2',{science:'✒'});card(1,'药剂师','green','2',{science:'⚗'});
card(1,'剧院','blue','',{vp:3});card(1,'祭坛','blue','',{vp:3});card(1,'浴场','blue','s',{vp:3});card(1,'酒馆','yellow','',{coins:4});
card(1,'石材储备','yellow','3',{discount:'s'});card(1,'黏土储备','yellow','3',{discount:'c'});card(1,'木材储备','yellow','3',{discount:'w'});
card(2,'锯木厂','brown','2',{res:'ww'});card(2,'砖厂','brown','2',{res:'cc'});card(2,'大型采石场','brown','2',{res:'ss'});card(2,'吹玻璃坊','gray','',{res:'g'});card(2,'晒纸房','gray','',{res:'p'});
card(2,'城墙','red','ss',{shield:2});card(2,'育马场','red','cw',{shield:1},'马厩');card(2,'兵营','red','3',{shield:1},'驻军营');card(2,'射箭场','red','swp',{shield:2});card(2,'阅兵场','red','ccg',{shield:2});
card(2,'图书馆','green','swg',{science:'✒',vp:2},'抄写室');card(2,'诊所','green','ccs',{science:'⚗',vp:2},'药剂师');card(2,'学校','green','wpp',{science:'☸',vp:1});card(2,'实验室','green','wgg',{science:'△',vp:1});
card(2,'雕像','blue','cc',{vp:4},'剧院');card(2,'神庙','blue','wp',{vp:4},'祭坛');card(2,'引水渠','blue','sss',{vp:5},'浴场');card(2,'讲坛','blue','sw',{vp:4});card(2,'法院','blue','wwg',{vp:5});
card(2,'论坛','yellow','3c',{wild:'gp'});card(2,'商队旅馆','yellow','2gp',{wild:'wcs'});card(2,'海关','yellow','4',{discount:'gp'});card(2,'酿酒坊','yellow','',{coins:6});
card(3,'军械库','red','cccww',{shield:3});card(3,'近卫军营','red','8',{shield:3});card(3,'防御工事','red','sscp',{shield:2},'栅栏');card(3,'攻城工坊','red','wwwg',{shield:2},'射箭场');card(3,'竞技场','red','ccss',{shield:2},'阅兵场');
card(3,'学院','green','swgg',{science:'⌁',vp:3});card(3,'研究所','green','wwgp',{science:'⌁',vp:3});card(3,'大学','green','cgp',{science:'◎',vp:2},'学校');card(3,'天文台','green','spp',{science:'◎',vp:2},'实验室');
card(3,'宫殿','blue','cswgg',{vp:7});card(3,'市政厅','blue','sssww',{vp:7});card(3,'方尖碑','blue','ssg',{vp:5});card(3,'花园','blue','ccww',{vp:6},'雕像');card(3,'万神殿','blue','cwpp',{vp:6},'神庙');card(3,'元老院','blue','ccsp',{vp:5},'讲坛');
card(3,'商会','yellow','pp',{vp:3,income:'gray',rate:3});card(3,'港口','yellow','wgp',{vp:3,income:'brown',rate:2});card(3,'武器库','yellow','ssg',{vp:3,income:'red',rate:1});card(3,'灯塔','yellow','ccg',{vp:3,income:'yellow',rate:1},'酒馆');card(3,'角斗场','yellow','csw',{vp:3,income:'wonder',rate:2},'酿酒坊');
[['商人公会','cwgp','yellow'],['船主公会','csgp','raw'],['建筑师公会','sscwg','wonder'],['执政官公会','wwcp','blue'],['科学家公会','ccww','green'],['放贷者公会','ssww','money'],['战术家公会','sscp','red']].forEach(([n,c,g])=>card(4,n,'purple',c,{guild:g}));
const WONDERS=[
{name:'亚庇大道',cost:'psscc',vp:3,coins:3,loss:3,replay:true},
{name:'大竞技场',cost:'sswg',vp:3,shield:1,destroy:'gray'},
{name:'罗德岛巨像',cost:'cccg',vp:3,shield:2},
{name:'亚历山大图书馆',cost:'wwwgp',vp:4,library:true},
{name:'亚历山大灯塔',cost:'swpp',vp:4,wild:'wcs'},
{name:'空中花园',cost:'wwgp',vp:3,coins:6,replay:true},
{name:'摩索拉斯陵墓',cost:'ccggp',vp:2,revive:true},
{name:'比雷埃夫斯港',cost:'wwcs',vp:2,wild:'gp',replay:true},
{name:'金字塔',cost:'sssp',vp:9},
{name:'狮身人面像',cost:'csgg',vp:6,replay:true},
{name:'宙斯神像',cost:'wscpp',vp:3,shield:1,destroy:'brown'},
{name:'阿耳忒弥斯神庙',cost:'wsgp',coins:12,replay:true}
].map((x,i)=>({...x,id:i,color:'wonder'}));
const TOKENS=[
{name:'农业',coins:6,vp:4,desc:'获得 6 金币、4 分'},
{name:'建筑学',desc:'建奇迹少付任意 2 个资源'},
{name:'经济学',desc:'获得对手贸易支付的金币'},
{name:'法律',science:'⚖',desc:'获得第七种科学符号'},
{name:'石工术',desc:'建蓝色建筑少付任意 2 个资源'},
{name:'数学',desc:'每枚进步标记计 3 分（含自身）'},
{name:'哲学',vp:7,desc:'获得 7 分'},
{name:'战略',desc:'之后建造的红色建筑额外推进 1 格'},
{name:'神学',desc:'之后建造的每个奇迹均可再行动一次'},
{name:'城市规划',coins:6,desc:'获得 6 金币；之后连锁建造获得 4 金币'}
];
if(typeof module!=='undefined')module.exports={CARDS,WONDERS,TOKENS};

// Expansion data. Names are local translations; printed effects are preserved.
const MYTHS=['美索不达米亚','腓尼基','希腊','埃及','罗马'];
const GODS=[
['恩基','enki',0,'翻开时抽盒中2枚进步；召唤时选1枚'],['伊什塔尔','ishtar',0,'获得法律科学符号'],['尼萨巴','nisaba',0,'以蛇标记复制对手1张绿牌的科学符号'],
['阿斯塔尔特','astarte',1,'获得7枚受保护金币；剩余每枚计1分'],['巴力','baal',1,'夺取对手1张棕色或灰色建筑'],['塔尼特','tanit',1,'获得12金币'],
['阿佛洛狄忒','aphrodite',2,'获得9分'],['哈迪斯','hades',2,'免费重建1张弃牌'],['宙斯','zeus',2,'弃置牌阵任意1张牌，获得其上的标记'],
['阿努比斯','anubis',3,'拆除双方任一已建奇迹的垫牌；奇迹可以重建'],['伊西斯','isis',3,'以1张弃牌免费建造自己的奇迹'],['拉','ra',3,'夺取对手1座未建奇迹'],
['玛尔斯','mars',4,'获得2面盾牌'],['密涅瓦','minerva',4,'在军事轨道放置阻挡棋子，下次移动至此格之前停止'],['涅普顿','neptune',4,'先移除1枚军事标记，再触发另一枚以针对对手']
].map(([name,key,myth,desc],id)=>({id,name,key,myth,desc}));
for(const [myth,cost] of ['wwwgp','wsgpp','sssgp','cccgp','csggp'].entries())card(5,MYTHS[myth]+'大神庙','temple',cost,{temple:myth});
// Provisional section distribution; see RULES-COVERAGE.txt.
for(const [j,section] of [0,0,0,1,1,2,2].entries())card(6,['左','中','右'][section]+'区政治家 '+(j+1),'white','',{senator:'politician',section});
for(let j=0;j<6;j++)card(6,'密谋者 '+(j+1),'black','',{senator:'conspirator'});
WONDERS.push(...[
{name:'圣所',cost:'ssgp',replay:true,sanctuary:true,exp:'pantheon'},
{name:'神圣剧院',cost:'w gpp'.replaceAll(' ',''),vp:2,theater:true,exp:'pantheon'},
{name:'尤利乌斯议事厅',cost:'wcsgp',coins:6,replay:true,curia:true,setup:'conspire',exp:'agora'},
{name:'克诺索斯宫',cost:'wcg',vp:3,knossos:true,setup:'place',exp:'agora'}
].map((w,i)=>({...w,id:i+12,color:'wonder'})));
TOKENS.push(...[
{name:'神秘主义',exp:'pantheon',desc:'每枚保留的神话/供奉标记计2分'},
{name:'攻城术',exp:'pantheon',desc:'每向对手推进1格军事，令其损失1金币'},
{name:'工程学',exp:'pantheon',desc:'带连锁条件的建筑可支付1金币建造（不算连锁）'},
{name:'腐败',exp:'agora',desc:'此后招募所有议员免费'},
{name:'有组织犯罪',exp:'agora',desc:'密谋抽取的2张阴谋均可保留'}
]);
const DECREES=[
...['yellow','red','green'].map(color=>({name:{yellow:'商业减免',red:'军事减免',green:'科学减免'}[color],key:'discount_'+color,desc:'建此颜色牌忽略1个费用符号（1资源或整项金币）'})),
{name:'奇迹减免',key:'wonder_discount',desc:'建奇迹少付1个任意资源'},
...['blue','green','yellow','red'].map(color=>({name:{blue:'民用税收',green:'科学税收',yellow:'商业税收',red:'军事税收'}[color],key:'income_'+color,desc:'任一方建此颜色牌，控制者获得等于时代数的金币'})),
{name:'奇迹税收',key:'income_wonder',desc:'任一方建奇迹，控制者获得等于时代数的金币'},
{name:'原料贸易',key:'trade_raw',desc:'购买木、土、石每份少1币，最低1币'},
{name:'制品贸易',key:'trade_man',desc:'购买玻、纸每份少1币，最低1币'},
{name:'政治动员',key:'blue_bonus',desc:'计算政治家行动次数时，蓝牌数加2'},
{name:'军力支持',key:'shield',desc:'控制时+1盾；失去控制时撤回这面盾'},
{name:'弃牌补贴',key:'discard',desc:'弃牌换币额外获得2金币'},
{name:'共享连锁',key:'chain',desc:'可使用对手建筑的连锁符号'},
{name:'密谋行动',key:'replay',desc:'招募密谋者后再行动一次'}
].map((d,id)=>({...d,id}));
const PLOTS=[
['商业欺诈','fraud','弃置对手1张黄牌；移动1影响力',['destroy_yellow','move']],
['勒索','extortion','夺取对手未建奇迹；移动1影响力',['steal_wonder','move']],
['蓄意破坏','sabotage','永久移除对手1座已建奇迹，保留已经获得的即时收益',['sabotage']],
['背叛','treason','秘密查看截至本时代开局移除的建筑，免费建1张',['treason']],
['政治操纵','maneuver','放置1影响力、移除对手1影响力、移动1影响力',['place','remove','move']],
['财产没收','confiscation','夺取对手1张棕色或灰色建筑',['steal_raw']],
['间谍','espionage','秘密查看盒中进步标记，选1枚获得',['espionage']],
['幕后影响','influence','将1枚法令移至另一议院，移动1影响力',['decree','move']],
['时局突变','turn_events','连续弃置最多2张可取牌；移动1影响力',['discard_board','discard_board','move']],
['征收','expropriation','弃置对手1张蓝牌；移动1影响力',['destroy_blue','move']],
['地产欺诈','property','免费建造牌阵中1张可取建筑（不含议员）',['free_board']],
['蒙昧主义','obscurantism','封存桌面、对手或盒中的1枚进步标记',['lock_token']],
['挪用公款','embezzlement','按各自议院中的方块数：自己获得金币，对手损失金币',['embezzle']],
['敲诈','blackmail','夺取对手金币的一半（向上取整）；移动1影响力',['half_coins','move']],
['胁迫','coercion','与对手交换1张同色蓝/绿牌；移动1影响力',['exchange','move']],
['政变','coup','获得2面盾牌',['shield2']]
].map(([name,key,desc,effects],id)=>({id,name,key,desc,effects}));
if(typeof module!=='undefined')Object.assign(module.exports,{MYTHS,GODS,DECREES,PLOTS});
