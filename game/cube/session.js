'use strict';
const HISTORY_KEY='cube.history';
function newRun(){return {phase:'idle',recorded:false,savedAt:null,sealed:false};}
function validRun(run){return run&&['idle','ready','running','solved'].includes(run.phase)&&typeof run.recorded==='boolean'&&typeof run.sealed==='boolean'&&(run.savedAt===null||Number.isFinite(run.savedAt));}
function loadRecords(){try{const data=JSON.parse(localStorage.getItem(HISTORY_KEY));return Array.isArray(data)?data.filter(r=>typeof r.initial==='string'&&typeof r.final==='string'&&Number.isFinite(r.elapsed)&&Number.isFinite(r.savedAt)):[];}catch{return [];}}
function rememberRun(){
 if(!currentRun.recorded||currentRun.sealed)return;
 const previous=currentRun.savedAt;
 const final=boardState(),existing=records.find(r=>r.savedAt===previous);
 if(existing&&existing.initial===initialState&&existing.final===final&&existing.elapsed===elapsed)return;
 const savedAt=records.reduce((time,r)=>Math.max(time,r.savedAt+1),Date.now());
 const record={initial:initialState,final,elapsed,savedAt};
 records=records.filter(r=>r.savedAt!==previous);records.unshift(record);currentRun.savedAt=savedAt;
}
function beginRun(){currentRun=newRun();currentRun.phase='ready';currentRun.recorded=true;initialState=boardState();elapsed=0;running=false;lastTick=performance.now();save();}
function advanceRun(){
 if(currentRun.phase==='ready'){currentRun.phase='running';running=true;lastTick=performance.now();}
 if(isSolved())completeRun();
}
function completeRun(){
 if(!['ready','running'].includes(currentRun.phase))return;
 running=false;currentRun.phase='solved';rememberRun();currentRun.sealed=true;toast('已还原');
}
function saveCurrent(){
 if(currentRun.sealed){currentRun=newRun();initialState=boardState();}
 currentRun.recorded=true;save();
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
  for(const [label,keep] of [['是',true],['否',false]]){const b=document.createElement('button');b.textContent=label;b.onclick=()=>{if(keep)saveCurrent();apply();$('modal').close();};actions.append(b);}
  box.append(p,actions);openDialog('保存当前状态',box);
 }else apply();
}
function formatTime(ms){const value=Math.floor(ms);return `${String(Math.floor(value/60000)).padStart(2,'0')}:${String(Math.floor(value/1000)%60).padStart(2,'0')}.${String(value%1000).padStart(3,'0')}`;}
function loadRecord(record,restart=false){
 save();menuDraft=null;
 const state=restart?record.initial:record.final;
 if(!restore({...snapshot(),state,initial:record.initial,elapsed:restart?0:record.elapsed,running:false,run:newRun()}))return;
 snap=null;animation=null;drag=null;
 if(restart)beginRun();
 syncSizes();controls();dirty=true;save();$('modal').close();
}
function showRecords(){
 historyThumbnailObserver.disconnect();save();const box=document.createElement('div');
 const list=document.createElement('div');list.className='history-list';
 for(const record of [...records].sort((a,b)=>b.savedAt-a.savedAt)){
  let info;try{info=CubeState.describe(record.final);}catch{continue;}
  const row=document.createElement('div'),item=document.createElement('button'),retry=document.createElement('button');row.className='history-row';item.className='history-item';
  const title=document.createElement('span'),time=document.createElement('span'),date=document.createElement('small');
  const dimensions=info.puzzleType==='cuboid'?info.size.join(' × '):info.puzzleType==='clock'?info.clockSize.join(' × '):['sq1','gear','helicopter','mixup'].includes(info.puzzleType)?'':`${info.order} 阶`;
  title.textContent=`${typeNames[info.puzzleType]} ${dimensions}`;
  time.textContent=formatTime(record.elapsed);date.textContent=new Date(record.savedAt).toLocaleString('zh-CN',{hour12:false});
  const thumbnail=document.createElement('canvas'),details=document.createElement('span');thumbnail.width=thumbnail.height=128;thumbnail.className='history-thumbnail';thumbnail.setAttribute('aria-hidden','true');details.className='history-details';details.append(title,time,date);item.append(thumbnail,details);historyThumbnails.set(thumbnail,record);historyThumbnailObserver.observe(thumbnail);
  item.onclick=()=>loadRecord(record);
  retry.textContent='重新挑战';retry.className='history-retry';retry.onclick=()=>loadRecord(record,true);
  row.append(item,retry);list.append(row);
 }
 if(!records.length){const empty=document.createElement('p');empty.textContent='暂无存档';box.append(empty);}
 box.append(list);openDialog('历史记录',box);
}
