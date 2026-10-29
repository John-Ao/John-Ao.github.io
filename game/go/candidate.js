// KaTrain normal evaluation palette and default point-loss thresholds.
export function candidateData(move,turn){
 const loss=Math.max(0,move.pointsLost??0);
 const [color,text]=loss>=12?['#72216b','#fff']:loss>=6?['#cc0000','#fff']:loss>=3?['#e6661a','#111']:loss>=1.5?['#f2f200','#111']:loss>=.5?['#abe62e','#111']:['#1e9600','#fff'];
 const lead=turn*move.scoreLead;
 return {color,text,loss:loss.toFixed(1),win:((turn===1?move.winRate:1-move.winRate)*100).toFixed(1),lead:`${lead>=0?'+':''}${lead.toFixed(1)}`,visits:move.visits>=1000?`${(move.visits/1000).toFixed(1)}k`:String(move.visits)};
}
