'use strict';
// Rules: official rulebook v2.30, pp. 7–17, 24.
// Card-specific values: cross-checked against LuaViper/StSBoardGameMod; see SOURCES.md.
const CARD_DATA = {
 strike:{name:'打击',en:'Strike',owner:'both',cost:1,type:'attack',rarity:'starter',hit:1,up:{hit:2}},
 defend:{name:'防御',en:'Defend',owner:'both',cost:1,type:'skill',rarity:'starter',block:1,up:{block:2}},
 bash:{name:'痛击',en:'Bash',owner:0,cost:2,type:'attack',rarity:'starter',hit:2,vulnerable:1,up:{hit:4}},
 survivor:{name:'生存者',en:'Survivor',owner:1,cost:1,type:'skill',rarity:'starter',block:2,discard:1,up:{block:3}},
 neutral:{name:'中和',en:'Neutralize',owner:1,cost:0,type:'attack',rarity:'starter',hit:1,weak:1,up:{hit:2}},
 cleave:{name:'顺劈斩',en:'Cleave',owner:0,cost:1,type:'attack',rarity:'common',hit:2,area:true,up:{hit:3}},
 pommel:{name:'剑柄打击',en:'Pommel Strike',owner:0,cost:1,type:'attack',rarity:'common',hit:2,draw:1,up:{draw:2}},
 ironwave:{name:'铁斩波',en:'Iron Wave',owner:0,cost:1,type:'attack',rarity:'common',hit:1,block:1,up:{mode:true}},
 inflame:{name:'燃烧',en:'Inflame',owner:0,cost:2,type:'power',rarity:'uncommon',strength:1,up:{cost:1}},
 shrug:{name:'耸肩无视',en:'Shrug It Off',owner:0,cost:1,type:'skill',rarity:'common',block:2,draw:1,up:{block:3}},
 heavy:{name:'重刃',en:'Heavy Blade',owner:0,cost:2,type:'attack',rarity:'common',hit:3,strengthMultiplier:3,up:{strengthMultiplier:5}},
 offering:{name:'祭品',en:'Offering',owner:0,cost:0,type:'skill',rarity:'rare',loseHP:1,energy:2,draw:3,exhaust:true,up:{draw:5}},
 twin:{name:'双重打击',en:'Twin Strike',owner:0,cost:1,type:'attack',rarity:'common',hit:1,hits:2,up:{hit:2}},
 trance:{name:'战斗专注',en:'Battle Trance',owner:0,cost:0,type:'skill',rarity:'uncommon',draw:3,noDraw:true,up:{draw:4}},
 impervious:{name:'岿然不动',en:'Impervious',owner:0,cost:2,type:'skill',rarity:'rare',block:6,exhaust:true,up:{block:8}},
 bludgeon:{name:'重锤',en:'Bludgeon',owner:0,cost:3,type:'attack',rarity:'rare',hit:7,up:{hit:10}},
 poison:{name:'致命毒药',en:'Deadly Poison',owner:1,cost:1,type:'skill',rarity:'common',poison:1,up:{cost:0}},
 dagger:{name:'匕首投掷',en:'Dagger Throw',owner:1,cost:1,type:'attack',rarity:'common',hit:2,draw:1,discard:1,up:{hit:3}},
 cloak:{name:'斗篷与匕首',en:'Cloak and Dagger',owner:1,cost:1,type:'skill',rarity:'common',shiv:1,block:1,up:{shiv:2}},
 backflip:{name:'后空翻',en:'Backflip',owner:1,cost:1,type:'skill',rarity:'common',block:1,draw:2,up:{block:2}},
 footwork:{name:'灵动步法',en:'Footwork',owner:1,cost:2,type:'power',rarity:'uncommon',dexterity:1,up:{retain:true}},
 sweep:{name:'扫腿',en:'Leg Sweep',owner:1,cost:2,type:'skill',rarity:'uncommon',block:3,weak:1,up:{block:4}},
 dash:{name:'冲刺',en:'Dash',owner:1,cost:2,type:'attack',rarity:'uncommon',hit:2,block:2,up:{hit:3,block:3}},
 adrenaline:{name:'肾上腺素',en:'Adrenaline',owner:1,cost:0,type:'skill',rarity:'rare',energy:1,draw:2,exhaust:true,up:{energy:2}},
 bladeDance:{name:'刀刃之舞',en:'Blade Dance',owner:1,cost:1,type:'skill',rarity:'common',shiv:2,up:{shiv:3}},
 acrobatics:{name:'杂技',en:'Acrobatics',owner:1,cost:1,type:'skill',rarity:'common',draw:3,discard:1,up:{draw:4}},
 spray:{name:'匕首雨',en:'Dagger Spray',owner:1,cost:1,type:'attack',rarity:'common',hit:1,hits:2,area:true,up:{hits:3}},
 prepared:{name:'准备',en:'Prepared',owner:1,cost:0,type:'skill',rarity:'common',draw:1,discard:1,up:{draw:2,discard:2}},
 poisonedStab:{name:'毒刺',en:'Poisoned Stab',owner:1,cost:1,type:'attack',rarity:'common',hit:1,poison:1,exhaust:true,up:{poison:2}},
 dieDieDie:{name:'死吧死吧死吧',en:'Die Die Die',owner:1,cost:1,type:'attack',rarity:'rare',hit:3,area:true,exhaust:true,up:{hit:4}},
 dazed:{name:'晕眩',en:'Daze',cost:null,type:'status',rarity:'status',ethereal:true,temporary:true},
 slimed:{name:'黏液',en:'Status — Slimed',cost:1,type:'status',rarity:'status',exhaust:true,temporary:true},
 burn:{name:'灼伤',en:'Status — Burn',cost:null,type:'status',rarity:'status',burn:1,temporary:true},
 injury:{name:'受伤',en:'Injury',cost:null,type:'curse',rarity:'curse'}
};
const RELIC_DATA={
 anchor:{name:'锚',en:'Anchor',price:6,text:'战斗开始：获得 2 格挡。'},
 lantern:{name:'灯笼',en:'Lantern',price:6,text:'战斗开始：获得 1 能量。'},
 bloodVial:{name:'血瓶',en:'Blood Vial',price:6,text:'战斗开始：回复 1 生命。'},
 flower:{name:'开心小花',en:'Happy Flower',price:6,text:'骰子为 3 或 4：获得 1 能量。'},
 stone:{name:'奇异光滑石',en:'Oddly Smooth Stone',price:7,text:'骰子为 4：获得 2 格挡。'},
 vajra:{name:'金刚杵',en:'Vajra',price:7,text:'骰子为 2：获得 1 力量，玩家回合结束时失去。'}
};
const POTION_DATA={
 blood:{name:'鲜血药水',price:3,text:'回复 2 生命；战斗外也可使用。',heal:2},
 block:{name:'格挡药水',price:2,text:'获得 2 格挡。',block:2},
 energy:{name:'能量药水',price:2,text:'获得 2 能量。',energy:2},
 fire:{name:'火焰药水',price:2,text:'对一个敌人造成 4 伤害；不是攻击，不受力量、易伤或虚弱影响。',damage:4},
 swift:{name:'迅捷药水',price:2,text:'抽 3 张牌。',draw:3},
 fear:{name:'恐惧药水',price:2,text:'对一个敌人施加 1 易伤。',vulnerable:1},
 weak:{name:'虚弱药水',price:2,text:'对一个敌人施加 1 虚弱。',weak:1}
};
const ENCOUNTERS={
 cultist:{name:'邪教徒',first:true,gold:1,enemies:[['cultist']]},
 jawEasy:{name:'大颚虫',first:true,gold:1,potion:true,enemies:[['jawEasy']]},
 slimesEasy:{name:'小型史莱姆群',first:true,gold:0,potion:true,enemies:[['spikeSmall'],['acid']]},
 liceEasy:{name:'双虱虫',first:true,gold:1,enemies:[['red','S21'],['green']]},
 cultistSpike:{name:'邪教徒与尖刺史莱姆',gold:1,potion:true,enemies:[['cultist'],['spike']]},
 cultistLouse:{name:'邪教徒与虱虫',gold:1,enemies:[['cultist'],['green']]},
 slimeTrio:{name:'史莱姆群',gold:1,enemies:[['spikeSmall'],['acid'],['spike']]},
 lice:{name:'三虱虫',gold:1,enemies:[['redHard','S22'],['green'],['red','21S']]},
 jaw:{name:'大颚虫',gold:1,enemies:[['jaw']]},
 fungi:{name:'真菌兽群',gold:1,potion:true,enemies:[['fungi','21S'],['fungi','S21']]},
 blueSlaver:{name:'蓝衣奴隶贩子',gold:2,enemies:[['blueSlaver','W3D']]},
 redSlaver:{name:'红衣奴隶贩子',gold:1,enemies:[['redSlaver','DV3']]}
};
const ENEMY_DATA={
 cultist:{name:'邪教徒',hp:9,rule:'每回合攻击 1，随后获得 1 力量。'},
 jawEasy:{name:'大颚虫',hp:8,behavior:'sda',rule:'骰子 1–2：格挡 2、力量 1；3–4：攻击 2、格挡 1；5–6：攻击 3。'},
 jaw:{name:'大颚虫',hp:10,behavior:'DAs',rule:'骰子 1–2：攻击 3、格挡 1；3–4：攻击 4；5–6：格挡 2、力量 1。'},
 spikeSmall:{name:'尖刺史莱姆（小）',hp:3,rule:'每回合攻击 1。'},
 acid:{name:'酸液史莱姆',hp:5,rule:'骰子决定攻击、晕眩或虚弱。'},
 spike:{name:'尖刺史莱姆',hp:5,rule:'骰子决定攻击、晕眩或易伤。'},
 red:{name:'红虱虫',hp:3,curl:2,rule:'第一次受到伤害后获得 2 格挡。'},
 redHard:{name:'红虱虫',hp:4,curl:2,rule:'第一次受到伤害后获得 2 格挡。'},
 green:{name:'绿虱虫',hp:3,curl:2,rule:'第一次受到伤害后获得 2 格挡。'},
 fungi:{name:'真菌兽',hp:5,rule:'死亡时对本行玩家施加 1 易伤。'},
 blueSlaver:{name:'蓝衣奴隶贩子',hp:10,rule:'骰子决定攻击、晕眩或虚弱。'},
 redSlaver:{name:'红衣奴隶贩子',hp:10,rule:'骰子决定攻击、晕眩或易伤。'},
 nob:{name:'地精大块头',hp:28,elite:true,rule:'首回合激怒；之后攻击所有玩家 3。激怒后，玩家打出技能结算完毕时受到 1 伤害。'},
 lagavulin:{name:'乐加维林',hp:44,elite:true,rule:'首回合休眠；之后循环：群攻 4、群攻 4、对所有玩家施加 2 虚弱并获得 1 力量。'},
 guardian:{name:'守护者',hp:80,boss:true,rule:'攻击模式：群攻 2、格挡 10；然后检查格挡，无格挡则不攻击并转防御，否则群攻 6。防御模式：群攻 2；群攻 4、力量 1、转攻击。防御模式下打出攻击牌后受到 1 伤害。'},
 hexaghost:{name:'六火亡魂',hp:72,boss:true,rule:'六步循环行动，施加灼伤；第六步获得 1 力量。'}
};
Object.assign(ENEMY_DATA,{
 sentryA:{name:'哨卫 A',hp:7,behavior:'D3',rule:'骰子 1–3：本行玩家获得 1 晕眩；4–6：攻击 3。'},
 sentryB:{name:'哨卫 B',hp:8,behavior:'3D',rule:'骰子 1–3：攻击 3；4–6：本行玩家获得 1 晕眩。'},
 sentries:{name:'哨卫',hp:7,elite:true,behavior:'2D',rule:'骰子 1–3：攻击 2；4–6：本行玩家获得 1 晕眩。布置时召唤哨卫 A/B，直到每位玩家对应 3 个敌人。'},
 slimeBoss:{name:'史莱姆老大',hp:44,boss:true,rule:'循环：群体 3 黏液；群攻 3、2 黏液；群攻 6。死亡后下一回合开始，在每行召唤大型、酸液、尖刺史莱姆。必须全部击败。'},
 largeSummon:{name:'大型史莱姆',hp:12,rule:'骰子决定攻击 4，或攻击 3 加 2 黏液，或攻击 1 加 2 虚弱。'},
 large:{name:'大型史莱姆',hp:8,rule:'循环：群攻 1；本行攻击 4 并施加 1 晕眩；在下回合开始召唤一只酸液史莱姆。'}
});
ENCOUNTERS.large={name:'大型史莱姆',gold:1,potion:true,enemies:[['large']]};
const NEOW_CARDS=[['-u','-r','DX'],['-r','-t','D%'],['-t','-5','GR'],['-?','-c','DR'],['-r','-5','GU'],['-u','-P','DU'],['-r','-t','3T']];
const ROOM_NAMES={M:'战斗',E:'精英','?':'事件',R:'营火',T:'宝箱','$':'商店',B:'首领'};
