'use strict';
const HISTORY_KEY='cuboid.history.v1';
function newRun(){return {id:globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`,created:Date.now(),phase:'idle',recorded:false};}
function validRun(run){return run&&typeof run.id==='string'&&Number.isFinite(run.created)&&['idle','ready','running','solved'].includes(run.phase)&&typeof run.recorded==='boolean';}
function loadRecords(){try{const data=JSON.parse(localStorage.getItem(HISTORY_KEY));return Array.isArray(data)?data.filter(r=>validRun(r.run)&&r.id===r.run.id&&Array.isArray(r.moves)&&Number.isFinite(r.updated)):[];}catch{return [];}}
function rememberRun(){
 if(!currentRun.recorded)return;
 const previous=records.find(r=>r.id===currentRun.id);
 // The first solved snapshot is immutable; later play belongs to no timed run.
 if(previous?.run.phase==='solved')return;
 const record={...snapshot(),id:currentRun.id,created:currentRun.created,updated:Date.now(),favorite:previous?.favorite===true};
 records=records.filter(r=>r.id!==record.id);records.unshift(record);
 let count=0;records=records.filter(r=>r.favorite||count++<100);
}
function beginRun(){currentRun=newRun();currentRun.phase='ready';currentRun.recorded=true;elapsed=0;running=false;lastTick=performance.now();save();}
function advanceRun(){
 if(currentRun.phase==='ready'){currentRun.phase='running';running=true;lastTick=performance.now();}
 if(isSolved())completeRun();
}
function completeRun(){
 if(!['ready','running'].includes(currentRun.phase))return;
 running=false;currentRun.phase='solved';rememberRun();toast('已还原');
}
function favoriteCurrent(){
 if(currentRun.phase==='solved'){currentRun=newRun();currentRun.recorded=true;}
 currentRun.recorded=true;rememberRun();const record=records.find(r=>r.id===currentRun.id);if(record)record.favorite=true;save();
}
function settingsSnapshot(){return structuredClone({puzzleType,order,size,clockSize,clockPrefs});}
function puzzleSettingsDiffer(next){
 return next.puzzleType!==puzzleType||(puzzleType==='cuboid'?next.size.some((n,i)=>n!==size[i]):puzzleType==='clock'?next.clockSize.some((n,i)=>n!==clockSize[i]):next.order!==order);
}
function finishMenuChanges(){
 const next=menuDraft;menuDraft=null;const changed=puzzleSettingsDiffer(next);
 const apply=()=>{
  save();clockPrefs=next.clockPrefs;
  if(changed){currentRun=newRun();puzzleType=next.puzzleType;order=next.order;size=next.size;clockSize=next.clockSize;camera=pose(3);zoom=1;snap=null;reset();snapView();}
  else{syncSizes();dirty=true;save();}
 };
 if(changed&&!isSolved()){
  const box=document.createElement('div'),p=document.createElement('p'),actions=document.createElement('div');p.textContent='是否保存当前状态';actions.className='dialog-actions';
  for(const [label,keep] of [['是',true],['否',false]]){const b=document.createElement('button');b.textContent=label;b.onclick=()=>{if(keep)favoriteCurrent();apply();$('modal').close();};actions.append(b);}
  box.append(p,actions);openDialog('保存当前状态',box);
 }else apply();
}
function formatTime(ms){const value=Math.floor(ms);return `${String(Math.floor(value/60000)).padStart(2,'0')}:${String(Math.floor(value/1000)%60).padStart(2,'0')}.${String(value%1000).padStart(3,'0')}`;}
function showRecords(){
 historyThumbnailObserver.disconnect();save();const box=document.createElement('div'),note=document.createElement('p');note.textContent=`${records.length} 条记录 · 未收藏最多保留 100 条，收藏不自动清理`;box.append(note);
 const list=document.createElement('div');list.className='history-list';
 for(const record of [...records].sort((a,b)=>Number(b.favorite)-Number(a.favorite)||b.updated-a.updated)){
  const row=document.createElement('div'),item=document.createElement('button'),star=document.createElement('button');row.className='history-row';item.className='history-item';
  const title=document.createElement('span'),time=document.createElement('span'),date=document.createElement('small');
  const dimensions=record.puzzleType==='cuboid'?record.size.join(' × '):record.puzzleType==='clock'?record.clockSize.join(' × '):['sq1','gear'].includes(record.puzzleType)?'':`${record.order} 阶`;
  title.textContent=`${typeNames[record.puzzleType]} ${dimensions} · ${{idle:'未开始',ready:'待开始',running:'进行中',solved:'已还原'}[record.run.phase]}`;
  time.textContent=formatTime(record.elapsed);date.textContent=new Date(record.created).toLocaleString('zh-CN',{hour12:false});
  const thumbnail=document.createElement('canvas'),details=document.createElement('span');thumbnail.width=thumbnail.height=128;thumbnail.className='history-thumbnail';thumbnail.setAttribute('aria-hidden','true');details.className='history-details';details.append(title,time,date);item.append(thumbnail,details);historyThumbnails.set(thumbnail,record);historyThumbnailObserver.observe(thumbnail);item.setAttribute('aria-current',String(record.id===currentRun.id));
  item.onclick=()=>{save();menuDraft=null;if(restore({...structuredClone(record),theme,dim})){snap=null;animation=null;drag=null;syncSizes();controls();dirty=true;save();$('modal').close();}};
  star.textContent=record.favorite?'★':'☆';star.className='history-star';star.setAttribute('aria-label',record.favorite?'取消收藏':'收藏');star.setAttribute('aria-pressed',String(record.favorite));star.dataset.favorite=record.id;
  star.onclick=()=>{record.favorite=!record.favorite;const live=records.find(r=>r.id===record.id);if(live)live.favorite=record.favorite;save();showRecords();[...$('dialog-content').querySelectorAll('[data-favorite]')].find(el=>el.dataset.favorite===record.id)?.focus();};
  row.append(item,star);list.append(row);
 }
 box.append(list);openDialog('历史记录',box);
}
