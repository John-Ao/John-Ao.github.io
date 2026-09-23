const $=id=>document.getElementById(id);
const catalog=$('catalog-view'),gridView=$('grid-view'),list=$('table-list'),grid=$('grid'),content=$('grid-content');
const passwordDialog=$('password-dialog'),progressDialog=$('progress-dialog'),searchDialog=$('search-dialog');
let manifest,selected,worker,controller,columns=[],rowCount=0,totalRows=0,searchActive=false,requestSeq=0;
let rendered={start:-1,end:-1},pendingRows=new Map();
const ROW_H=34, HEAD_H=38, MIN_ROW_NUMBER_W=64, BUFFER=20;
let rowNumberWidth=MIN_ROW_NUMBER_W;

function formatBytes(bytes){if(bytes<1024)return `${bytes} B`;if(bytes<1048576)return `${(bytes/1024).toFixed(1)} KB`;return `${(bytes/1048576).toFixed(1)} MB`}
function setProgress(percent,title,detail=''){
  const ring=document.querySelector('.progress-ring'),circle=$('progress-circle'),value=$('progress-value');
  $('progress-title').textContent=title;$('progress-detail').textContent=detail;
  if(percent==null){ring.classList.add('indeterminate');value.textContent='';circle.style.strokeDashoffset='';}
  else{ring.classList.remove('indeterminate');const p=Math.max(0,Math.min(100,percent));value.textContent=`${Math.round(p)}%`;circle.style.strokeDashoffset=String(263.9*(1-p/100));}
}

async function loadCatalog(){
  try{const response=await fetch(`data/manifest.json?v=${Date.now()}`,{cache:'no-store'});if(!response.ok)throw new Error(response.status===404?'尚未生成加密数据':'目录读取失败');manifest=await response.json();if(manifest.format!=='john-ao-database-v1')throw new Error('不支持的数据格式');renderCatalog();}
  catch(error){list.innerHTML='';const p=document.createElement('p');p.className='error';p.textContent=error.message;list.append(p);}
}
function renderCatalog(){list.innerHTML='';if(!manifest.tables.length){list.innerHTML='<p class="muted">暂无数据表。</p>';return}for(const table of manifest.tables){const button=document.createElement('button');button.className='table-card';const heading=document.createElement('div'),name=document.createElement('strong');heading.className='card-heading';name.textContent=table.name;heading.append(name);if(table.encrypted!==false){const lock=document.createElement('span');lock.className='lock-icon';lock.textContent='🔒';lock.setAttribute('aria-label','已加密');heading.append(lock)}button.append(heading);button.onclick=()=>table.encrypted===false?startPublic(table):askPassword(table);list.append(button)}}
function askPassword(table){selected=table;$('password-title').textContent=`解锁 ${table.name}`;$('password-error').textContent='';$('password-input').value='';passwordDialog.showModal();setTimeout(()=>$('password-input').focus(),0)}

$('password-form').addEventListener('submit',event=>{event.preventDefault();const password=$('password-input').value;if(new TextEncoder().encode(password).length<8){$('password-error').textContent='密码至少需要 8 个 UTF-8 字节';return}$('password-input').value='';passwordDialog.close();startUnlock(password)});
$('cancel-password-button').addEventListener('click',()=>passwordDialog.close());

async function startUnlock(password){
  controller=new AbortController();worker=new Worker('js/worker.js',{type:'module'});let derived=false,downloaded=null;
  progressDialog.showModal();setProgress(0,'正在下载数据库…',`0 B / ${formatBytes(selected.bytes)}`);
  worker.onmessage=({data})=>{
    if(data.type==='derived'){derived=true;setProgress(null,'正在解密');if(downloaded)worker.postMessage({type:'ciphertext',ciphertext:downloaded},[downloaded]);}
    else if(data.type==='stage'){setProgress(null,data.stage==='decompress'?'正在解压':'正在解析');}
    else if(data.type==='ready'){columns=data.columns;rowCount=data.rowCount;showGrid();}
    else if(data.type==='rows')receiveRows(data);
    else if(data.type==='search-progress')$('result-summary').textContent=`已搜索 ${data.scanned.toLocaleString()} / ${data.total.toLocaleString()} 行`;
    else if(data.type==='search-result'){searchActive=true;rowCount=data.count;$('result-summary').textContent=`${rowCount.toLocaleString()} 条结果`;$('clear-search-button').classList.remove('hidden');resetGrid();searchDialog.close();}
    else if(data.type==='error')failUnlock(data.message);
  };
  worker.onerror=()=>failUnlock('解密工作线程发生错误');
  worker.postMessage({type:'derive',password,table:selected});password='';
  try{downloaded=await downloadCipher(selected,controller.signal);if(derived)worker.postMessage({type:'ciphertext',ciphertext:downloaded},[downloaded]);else setProgress(null,'正在解密');}
  catch(error){if(error.name!=='AbortError')failUnlock(error.message)}
}

async function startPublic(table){
  selected=table;controller=new AbortController();worker=new Worker('js/worker.js',{type:'module'});
  progressDialog.showModal();setProgress(0,'正在下载数据库…',`0 B / ${formatBytes(table.bytes)}`);
  worker.onmessage=({data})=>{
    if(data.type==='stage')setProgress(null,'正在解析');
    else if(data.type==='ready'){columns=data.columns;rowCount=data.rowCount;showGrid();}
    else if(data.type==='rows')receiveRows(data);
    else if(data.type==='search-progress')$('result-summary').textContent=`已搜索 ${data.scanned.toLocaleString()} / ${data.total.toLocaleString()} 行`;
    else if(data.type==='search-result'){searchActive=true;rowCount=data.count;$('result-summary').textContent=`${rowCount.toLocaleString()} 条结果`;$('clear-search-button').classList.remove('hidden');resetGrid();searchDialog.close();}
    else if(data.type==='error')failPublic(data.message);
  };
  worker.onerror=()=>failPublic('数据处理工作线程发生错误');
  try{const contents=await downloadCipher(table,controller.signal);worker.postMessage({type:'public',contents},[contents]);}
  catch(error){if(error.name!=='AbortError')failPublic(error.message)}
}
function failPublic(message){cancelLoad();alert(message)}

async function downloadCipher(table,signal){
  const response=await fetch(`data/${table.file}`,{signal,cache:'no-store'});if(!response.ok)throw new Error(`下载失败 (${response.status})`);
  const total=Number(response.headers.get('Content-Length'))||table.bytes;
  if(!response.body){const data=await response.arrayBuffer();setProgress(100,'数据库下载完成',`${formatBytes(data.byteLength)} / ${formatBytes(total)}`);return data}
  const reader=response.body.getReader(),chunks=[];let received=0;
  while(true){const {done,value}=await reader.read();if(done)break;chunks.push(value);received+=value.length;setProgress(total?received/total*100:null,'正在下载数据库…',`${formatBytes(received)} / ${formatBytes(total)}`)}
  const joined=new Uint8Array(received);let offset=0;for(const chunk of chunks){joined.set(chunk,offset);offset+=chunk.length}return joined.buffer;
}
function failUnlock(message){cancelLoad();$('password-error').textContent=message;passwordDialog.showModal()}
function cancelLoad(){controller?.abort();worker?.terminate();worker=null;controller=null;if(progressDialog.open)progressDialog.close()}
$('cancel-load-button').onclick=cancelLoad;

function showGrid(){if(progressDialog.open)progressDialog.close();catalog.classList.add('hidden');gridView.classList.remove('hidden');$('current-table').textContent=selected.name;totalRows=rowCount;const longest=(totalRows+1).toLocaleString().length;rowNumberWidth=Math.max(MIN_ROW_NUMBER_W,longest*9+28);$('result-summary').textContent=`${rowCount.toLocaleString()} 行`;searchActive=false;resetGrid()}
function lockAndBack(){cancelLoad();columns=[];rowCount=0;totalRows=0;searchActive=false;content.replaceChildren();gridView.classList.add('hidden');catalog.classList.remove('hidden');$('clear-search-button').classList.add('hidden')}
$('back-button').onclick=lockAndBack;

function widths(){return `${rowNumberWidth}px `+columns.map(()=> 'minmax(140px, 1fr)').join(' ')}
function header(){const row=document.createElement('div');row.className='grid-row header';row.style.gridTemplateColumns=widths();const corner=document.createElement('div');corner.className='cell row-number';corner.textContent='#';row.append(corner);for(const name of columns){const cell=document.createElement('div');cell.className='cell';cell.textContent=name;cell.title=name;row.append(cell)}return row}
function resetGrid(){rendered={start:-1,end:-1};pendingRows.clear();content.replaceChildren(header());content.style.height=`${HEAD_H+rowCount*ROW_H}px`;grid.scrollTop=0;renderViewport(true)}
function renderViewport(force=false){
  const start=Math.max(0,Math.floor(Math.max(0,grid.scrollTop-HEAD_H)/ROW_H)-BUFFER),end=Math.min(rowCount,start+Math.ceil(grid.clientHeight/ROW_H)+BUFFER*2);
  if(!force&&start===rendered.start&&end===rendered.end)return;rendered={start,end};for(const node of [...content.querySelectorAll('.grid-row:not(.header)')])node.remove();
  if(end<=start)return;const id=++requestSeq;pendingRows.set(id,{start,end});worker.postMessage({type:'rows',requestId:id,start,end,useSearch:searchActive});
}
function receiveRows(data){const expected=pendingRows.get(data.requestId);pendingRows.delete(data.requestId);if(!expected||expected.start!==rendered.start)return;const fragment=document.createDocumentFragment();data.rows.forEach((item,offset)=>{const visual=data.start+offset,row=document.createElement('div');row.className='grid-row';row.style.top=`${HEAD_H+visual*ROW_H}px`;row.style.gridTemplateColumns=widths();const number=document.createElement('div');number.className='cell row-number';number.textContent=(item.index+2).toLocaleString();row.append(number);for(const value of item.row){const cell=document.createElement('div');cell.className='cell';cell.tabIndex=0;cell.textContent=value;cell.title=value;row.append(cell)}fragment.append(row)});content.append(fragment)}
grid.addEventListener('scroll',()=>requestAnimationFrame(()=>renderViewport()));addEventListener('resize',()=>renderViewport(true));

function addCondition(initial={}){const node=$('condition-template').content.firstElementChild.cloneNode(true),select=node.querySelector('select');columns.forEach((name,index)=>{const option=document.createElement('option');option.value=index;option.textContent=name;select.append(option)});node.querySelectorAll('[data-flag]').forEach(button=>button.onclick=()=>button.classList.toggle('active'));node.querySelector('.remove-condition').onclick=()=>{if($('conditions').children.length>1)node.remove()};$('conditions').append(node)}
$('search-button').onclick=()=>{$('conditions').replaceChildren();addCondition();$('search-error').textContent='';searchDialog.showModal()};$('add-condition').onclick=()=>addCondition();
$('search-form').addEventListener('submit',event=>{event.preventDefault();const conditions=[];try{for(const row of $('conditions').children){const text=row.querySelector('input').value;if(!text)throw new Error('搜索文本不能为空');if(text.length>256)throw new Error('搜索文本不能超过 256 个字符');const active=flag=>row.querySelector(`[data-flag="${flag}"]`).classList.contains('active');const c={column:Number(row.querySelector('select').value),text,caseSensitive:active('case'),word:active('word'),regex:active('regex')};if(c.regex)new RegExp(c.text,c.caseSensitive?'u':'iu');conditions.push(c)}}catch(error){$('search-error').textContent=error.message;return}$('result-summary').textContent='正在搜索…';worker.postMessage({type:'search',conditions})});
$('cancel-search-button').addEventListener('click',()=>searchDialog.close());
$('clear-search-button').onclick=()=>{searchActive=false;rowCount=totalRows;$('result-summary').textContent=`${rowCount.toLocaleString()} 行`;$('clear-search-button').classList.add('hidden');resetGrid()};
loadCatalog();
