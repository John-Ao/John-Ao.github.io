(()=>{
'use strict';
const G=createDotsGame(),$=id=>document.getElementById(id),NS='http://www.w3.org/2000/svg';
let rows=5,cols=5,moves=[],b,s,worker=null,analyzing=false,heat=new Map(),analysisId=0;
const colors=['','#2468b5','#c66b25'],fills=['','#e4eefb','#fbead9'];
function el(tag,attrs={},text){const n=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));if(text!==undefined)n.textContent=text;return n;}
function notify(text){$('notice').textContent=text;$('notice').style.display='block';clearTimeout(notify.timer);notify.timer=setTimeout(()=>$('notice').style.display='none',2400);}
function load(){try{if(!location.hash)return;const data=JSON.parse(decodeURIComponent(location.hash.slice(1)));if(data.v!==1||!Number.isInteger(data.r)||!Number.isInteger(data.c)||data.r<1||data.r>12||data.c<1||data.c>12||!Array.isArray(data.m))throw Error();const board=G.board(data.r,data.c);if(data.m.length>board.edges.length)throw Error();G.replay(board,data.m);rows=data.r;cols=data.c;moves=data.m;}catch{rows=cols=5;moves=[];notify('网址中的棋局无效，已新建棋盘');}}
function save(){try{history.replaceState(null,'','#'+encodeURIComponent(JSON.stringify({v:1,r:rows,c:cols,m:moves})));}catch{notify('浏览器未允许更新网址');}}
function fit(){const area=$('arena'),ratio=(cols*100+60)/(rows*100+60);let w=area.clientWidth-16,h=area.clientHeight-16;if(w/h>ratio)w=h*ratio;else h=w/ratio;$('board').style.width=Math.max(0,w)+'px';$('board').style.height=Math.max(0,h)+'px';}
function compactCount(n){return n>=1000000?(n/1000000).toFixed(1)+'m':n>=10000?(n/1000).toFixed(1)+'k':n.toLocaleString();}
function formatMargin(h){if(!h||!Number.isFinite(h.margin))return '—';const rounded=Number(h.margin.toFixed(1));return `${rounded>0?'+':''}${rounded.toFixed(1)}`;}
function render(){
 const svg=$('board'),focused=document.activeElement?.getAttribute('data-edge');svg.replaceChildren();svg.setAttribute('viewBox',`-30 -30 ${cols*100+60} ${rows*100+60}`);
 s.boxes.forEach((p,i)=>{if(p)svg.append(el('rect',{x:i%cols*100+5,y:Math.floor(i/cols)*100+5,width:90,height:90,rx:9,fill:fills[p]}));});
 const labels=el('g',{'aria-hidden':'true'});let best=-1,worst=1;for(const h of heat.values()){best=Math.max(best,h.rate);worst=Math.min(worst,h.rate);}
 const spread=Math.max(.08,best-worst),mid=(best+worst)/2;
 const rankKey=h=>`${h.rate}:${h.margin}`;
 const ranked=[...heat.values()].sort((a,b)=>b.rate-a.rate||b.margin-a.margin);
 const topRanks=[...new Set(ranked.map(rankKey))].slice(0,3);
 const rankColors=['#ff4545','#ff9696','#ffe0e0'];
 function rankColor(h){return h?rankColors[topRanks.indexOf(rankKey(h))]:undefined;}
 function intensity(h){return Math.max(0,Math.min(1,.5+(h.rate-mid)/spread));}
 b.edges.forEach((e,i)=>{
   const x=e.x*100,y=e.y*100,x2=x+(e.h?100:0),y2=y+(e.h?0:100),p=s.edges[i],h=heat.get(i);
   svg.append(el('line',{x1:x,y1:y,x2,y2,stroke:p?colors[p]:'#e4e7ec','stroke-width':p?6:4,class:'edge'}));
   if(!p){
     const hit=el('line',{x1:x,y1:y,x2,y2,class:'hit','data-edge':i,tabindex:0,role:'button','aria-label':`${e.h?'横':'竖'}边 ${e.y+1}行 ${e.x+1}列${h?`，估计胜率${Math.round(h.rate*100)}%，预计净胜${formatMargin(h)}格`:''}`});
     if(h)hit.append(el('title',{},`估计胜率 ${(h.rate*100).toFixed(1)}% · ${h.exact?'精确':h.outcomeProven?'胜负已证，预计':'预计'}净胜 ${formatMargin(h)} 格 · ${h.n.toLocaleString()} 次（模拟 ${h.visits||0}，证明 ${h.proofVisits||0}）${!h.exact&&h.outcomeProven?' · 已证分差范围 ['+h.lower+', '+h.upper+']':''}${h.shared>1?' · '+h.shared+' 个对称落点共享统计':''}`));
     hit.addEventListener('click',()=>move(i));hit.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();move(i);}});svg.append(hit,el('line',{x1:x,y1:y,x2,y2,stroke:colors[s.turn],class:'preview'}));
     if(analyzing){const cx=(x+x2)/2,cy=(y+y2)/2;const group=el('g');group.append(el('rect',{x:cx-24,y:cy-22,width:48,height:44,rx:7,fill:h?`hsl(145 ${35+intensity(h)*35}% ${97-intensity(h)*72}%)`:'#f0f4f1',stroke:rankColor(h)||'#ffffff','stroke-width':rankColor(h)?3:1}));const text=el('text',{x:cx,y:cy-9,class:'heat-label',fill:h&&intensity(h)>.55?'#fff':'#19432c'});text.append(el('tspan',{x:cx,class:'rate'},h?`${(h.rate*100).toFixed(1)}%${h.outcomeProven&&!h.exact?'*':''}`:'—'),el('tspan',{x:cx,dy:12,class:'margin'},formatMargin(h)),el('tspan',{x:cx,dy:11,class:'visits'},h?`${h.exact?'✓ ':''}${compactCount(h.n)}`:'0'));group.append(text);labels.append(group);}
   }
 });
 labels.style.pointerEvents='none';svg.append(labels);
 for(let y=0;y<=rows;y++)for(let x=0;x<=cols;x++)svg.append(el('circle',{cx:x*100,cy:y*100,r:5,class:'dot'}));
 $('score1').textContent=s.scores[0];$('score2').textContent=s.scores[1];$('remaining').textContent=b.boxes.length-s.scores[0]-s.scores[1];
 $('turn').textContent=s.left?`${s.turn===1?'蓝':'橙'}方落子`:s.scores[0]===s.scores[1]?'平局':`${s.scores[0]>s.scores[1]?'蓝':'橙'}方获胜`;
 $('blue').classList.toggle('active',!!s.left&&s.turn===1);$('orange').classList.toggle('active',!!s.left&&s.turn===2);$('undo').disabled=!moves.length;$('restart').disabled=!moves.length;fit();if(focused!==null&&focused!==undefined)svg.querySelector(`[data-edge="${focused}"]`)?.focus({preventScroll:true});
}
function stop(){analysisId++;if(worker)worker.postMessage({type:'pause'});}
function analyze(){stop();heat.clear();if(!analyzing||!s.left){$('analysisInfo').textContent=s.left?'双人对弈':'对局结束';return;}
 $('analysisInfo').textContent='正在分析 · 相对色阶';
 try{if(!worker){const source=`${createDotsGame.toString()}\n(${dotsWorkerMain.toString()})();`;const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));worker=new Worker(url);URL.revokeObjectURL(url);const active=worker;
 worker.onmessage=({data})=>{if(worker!==active||data.id!==analysisId)return;heat=new Map(data.results.map(r=>[r.edge,r]));$('analysisInfo').textContent=`${data.done?'全部精确':'分析中'} · 已证 ${data.provenCount}/${s.left} · 精确 ${data.exactCount}/${s.left} · ${data.total.toLocaleString()} 次`;render();};
 worker.onerror=()=>{worker.terminate();worker=null;analysisId++;analyzing=false;$('analysis').setAttribute('aria-pressed','false');heat.clear();render();$('analysisInfo').textContent='分析无法启动，请通过本地服务器打开';};}worker.postMessage({rows,cols,moves,id:analysisId});
 }catch{analyzing=false;$('analysis').setAttribute('aria-pressed','false');$('analysisInfo').textContent='此浏览器不支持后台分析';}}
function refresh(){b=G.board(rows,cols);s=G.replay(b,moves);$('rows').value=rows;$('cols').value=cols;save();analyze();render();}
function move(i){if(s.edges[i])return;moves.push(i);refresh();}
$('undo').onclick=()=>{moves.pop();refresh();};$('restart').onclick=()=>{moves=[];refresh();};
$('resize').onclick=()=>{const r=Number($('rows').value),c=Number($('cols').value);if(!Number.isInteger(r)||!Number.isInteger(c)||r<1||r>12||c<1||c>12){notify('行列数需为 1–12 的整数');return;}if(r===rows&&c===cols)return;rows=r;cols=c;moves=[];refresh();};
$('analysis').onclick=()=>{analyzing=!analyzing;$('analysis').setAttribute('aria-pressed',String(analyzing));analyze();render();};
window.addEventListener('hashchange',()=>{load();refresh();});new ResizeObserver(fit).observe($('arena'));load();refresh();
})();
