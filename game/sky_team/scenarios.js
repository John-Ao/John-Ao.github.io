/* Route entries run from the cloud/start space to the airport.
   Transcribed from the publisher's Print & Play PDF, even pages 2–14.
   Turns constrain the space being DEPARTED, not the destination. */
(function(root){
const abilities={control:['操控','轴线双骰相同，获得 1 杯咖啡。'],mastery:['精通','引擎双骰相同，从未占用的库存获得 1 枚重掷标记。'],adaptation:['适应','每位玩家每局一次，将自己的未放置骰翻到相反面（7−点数）。'],anticipation:['预判','每轮先手放第一枚骰前，可以重掷自己的一枚骰一次。'],synchronisation:['同步','每轮起落架与襟翼均已放骰时，副驾驶立即放置一枚额外交通骰，忽略颜色。'],workingTogether:['协作','每轮一次，双方分别选择一枚未用骰，交换点数。']};
const modules={fuel:'燃油管理',leak:'燃油泄漏',intern:'实习生',wind:'风向',headwind:'逆风',ice:'冰面刹车',realtime:'60 秒实时',alarms:'系统警报',glide:'无动力滑翔',stuckGear:'起落架卡死'};
const route=(planes,traffic={},turns={},alarms=[],silent=[])=>planes.map((n,i)=>({planes:n,traffic:traffic[i]||0,turns:turns[i]||null,alarm:alarms.includes(i),silent:silent.includes(i)}));
const presets=[];
function add(id,name,difficulty,planes,traffic,turns,mods=[],abilityCount=0,extra={}){presets.push({id,name,difficulty,route:route(planes,traffic,turns),modules:mods,abilityCount,start:6000,rerollAt:['红','黑'].includes(difficulty)?[6000]:[6000,2000],weather:{},source:'官方 Print & Play',...extra});}
add('YUL','YUL · 蒙特利尔','绿',[0,0,1,2,1,3,2],{}, {},[],0,{source:'本体 · Landing Procedure'});
add('BLQ-G','BLQ · 博洛尼亚','绿',[1,1,1,1,2,2],{0:3,2:1},{1:[-1,0],3:[0,1]},['leak']);
add('BLQ-R','BLQ · 博洛尼亚','红',[1,1,2,1,1,2],{0:3},{1:[0],3:[0]},['fuel'],1);
add('BUD-Y','BUD · 布达佩斯','黄',[0,1,1,2,1,2],{0:3,3:1},{2:[0,1],4:[-2,-1]},['wind']);
add('BUD-R','BUD · 布达佩斯','红',[1,1,1,1,1,1],{0:4,2:1,3:1},{2:[0,1],3:[1,2],4:[-2,-1]},['wind'],2,{start:5000});
add('NZIR-R','NZIR · 南极冰跑道','红',[0,0,0,1,1,1,0,0],{0:3},{1:[-2,-1],4:[0,1]},['wind','headwind','ice'],1);
add('NZIR-B','NZIR · 南极冰跑道','黑',[0,1,0,0,0,0,0,0],{0:2},{2:[-1,0],4:[1,2],6:[-1,0]},['wind','headwind','ice','fuel','intern']);
add('TER-Y','TER · 亚速尔拉日什','黄',[0,0,0,0,1,1,1],{0:3},{0:[-2,-1],1:[0,1,2],2:[-2,-1],3:[1,2],4:[-2,-1],5:[1,2]},['glide','ice'],2);
add('TER-B','TER · 亚速尔拉日什','黑',[0,0,0,1,1,1,1],{0:3},{0:[-2,-1],1:[1,2],2:[-2,-1],3:[1,2],4:[-2,-1],5:[1,2]},['glide','ice'],1);
add('CDG-Y','CDG · 巴黎戴高乐','黄',[0,1,0,0,2,2,1,2],{0:3,3:1,4:1,5:1},{},['wind','intern']);
add('CDG-R','CDG · 巴黎戴高乐','红',[1,0,0,0,1,1,2,1],{0:2,3:1,5:1},{3:[-2,-1],5:[1,2]},['fuel','wind','intern']);
add('DUS-Y','DUS · 杜塞尔多夫','黄',[0,1,1,2,1,2,1,1],{0:3,5:2},{3:[-1,0,1],5:[-1,0,1]},['leak'],2);
add('DUS-B','DUS · 杜塞尔多夫','黑',[1,0,0,1,2,1,3,2],{0:2,2:1,3:2,5:1},{1:[0],3:[-2,-1],5:[1,2]},['realtime','leak'],1);
add('LGA-Y','LGA · 纽约拉瓜迪亚','黄',[0,0,0,1,2,1,1],{0:1,2:1,4:1},{1:[0,1,2],3:[-2,-1,0]},['ice'],2);
add('LGA-B','LGA · 纽约拉瓜迪亚','黑',[0,0,0,0,1,1,0],{2:1,4:1},{0:[0,1,2],2:[1,2],4:[-2,-1]},['fuel','ice'],1);

// Base-box route boards; visual board transcription checked against Flight Log modules.
const baseStart=presets.length;
add('LHR-G','LHR · 伦敦希思罗','绿',[0,1,1,2,2,2],{0:1,2:1,4:1},{});
add('HND-G','HND · 东京羽田（2023）','绿',[0,1,1,2,1,0,2,1],{0:2},{2:[-1,0,1],4:[-2,-1],5:[-2,-1,0]});
add('OSL-G','OSL · 奥斯陆','绿',[0,0,1,0,1,1,1,0],{0:2,3:1},{},['fuel']);
add('ATL-G','ATL · 亚特兰大','绿',[0,0,0,0,1,2,1,2],{0:4,2:1,4:1,5:1},{},['intern']);
add('PRG-G','PRG · 布拉格','绿',[0,0,1,1,0,1,1,1],{0:1,2:1,5:1},{1:[-1,0,1],3:[1,2]},['fuel'],2);
add('LHR-Y','LHR · 伦敦希思罗','黄',[1,1,1,2,1,2],{0:2,2:1,3:1,4:1},{},['intern']);
add('TGU-Y','TGU · 通孔廷','黄',[0,1,1,1,1],{0:3},{1:[-2,-1],2:[-1,0],3:[-2,-1]},['fuel'],2);
add('GIG-Y','GIG · 里约热内卢','黄',[0,0,2,1,2,3,1],{0:2,3:1,4:1},{},['wind'],1);
add('KEF-Y','KEF · 凯夫拉维克','黄',[0,0,1,1,1,0],{0:2,2:1,4:1},{},['ice'],1);
add('PRG-Y','PRG · 布拉格','黄',[0,0,1,3,0,3,2,3],{3:1,5:1},{},['leak'],2);
add('KUL-Y','KUL · 吉隆坡','黄',[0,0,1,1,0,1,1,1],{0:2,3:1},{1:[1,2],3:[0,1],4:[1,2],6:[1,2]},['fuel'],1);
add('ATL-Y','ATL · 亚特兰大','黄',[0,1,0,2,2,1,3,1],{0:1,1:1,3:2,4:1},{2:[-1,0,1],6:[1,2]},['leak'],1);
add('PBH-R','PBH · 帕罗','红',[0,1,1,1,1,1],{0:3,2:1,3:1},{2:[-2,-1],3:[-2,-1,0],4:[1,2]},['fuel','realtime'],2);
add('OSL-R','OSL · 奥斯陆','红',[1,0,1,0,0,1,0,0],{0:3,2:1,4:1,6:1},{},['leak','ice'],2);
add('HND-R','HND · 东京羽田（2023）','红',[1,0,1,1,1,2,1,1],{0:3,3:1,4:1,5:1},{1:[-1,0,1],3:[-2,-1],4:[-1,0,1],6:[-2,-1]},['fuel','intern'],1);
add('GIG-R','GIG · 里约热内卢','红',[0,1,2,2,1,1,2],{0:3,2:1,4:1},{},['wind','leak'],2);
add('TGU-R','TGU · 通孔廷','红',[0,1,1,1,2],{0:3,2:2},{1:[-2,-1],2:[-1,0],3:[-2,-1]},['fuel','wind'],2);
add('KEF-B','KEF · 凯夫拉维克','黑',[0,0,2,1,1,0],{0:2,2:1},{1:[-2,-1,0],3:[0,1,2],4:[-1,0,1]},['wind','ice'],2);
add('KUL-B','KUL · 吉隆坡','黑',[0,0,1,0,1,1,1,1],{0:3,2:1,5:1},{1:[-1,0,1],3:[-2],4:[-1,0],5:[0,1],6:[1,2]},['fuel','realtime'],2);
add('PBH-B','PBH · 帕罗','黑',[1,0,1,1,1,1],{0:3,2:1,3:1,4:1},{2:[-2,-1],3:[-2,-1],4:[2]},['fuel','realtime'],2);
for(let i=baseStart;i<presets.length;i++)presets[i].source='本体 · Flight Log（2023）';
presets.sort((a,b)=>{let group=x=>x.source.startsWith('本体')?0:1;return group(a)-group(b)||['绿','黄','红','黑'].indexOf(a.difficulty)-['绿','黄','红','黑'].indexOf(b.difficulty);});

const api={abilities,modules,presets,route};root.SkyData=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
