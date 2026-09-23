import loadArgon2id from './vendor/argon2id-loader.js';

const encoder = new TextEncoder();

function decode64(value) {
  const raw = atob(value); const out = new Uint8Array(raw.length);
  for (let i=0;i<raw.length;i++) out[i]=raw.charCodeAt(i);
  return out;
}

async function gunzip(bytes) {
  if (!globalThis.DecompressionStream) throw new Error('此浏览器不支持 gzip 解压');
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function parseTsv(text) {
  const rows=[]; let row=[], field='', quoted=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(quoted){
      if(ch==='"'&&text[i+1]==='"'){field+='"';i++;}
      else if(ch==='"') quoted=false; else field+=ch;
    } else if(ch==='"'&&field==='') quoted=true;
    else if(ch==='\t'){row.push(field);field='';}
    else if(ch==='\n'){row.push(field);rows.push(row);row=[];field='';}
    else if(ch!=='\r') field+=ch;
  }
  if(field!==''||row.length){row.push(field);rows.push(row);}
  if(!rows.length) throw new Error('数据表为空');
  return {columns:rows[0],rows:rows.slice(1)};
}

function compile(condition){
  let source=condition.text;
  if(!condition.regex) source=source.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  if(condition.word) source=`(?<![\\p{L}\\p{N}_])(?:${source})(?![\\p{L}\\p{N}_])`;
  return new RegExp(source,condition.caseSensitive?'u':'iu');
}

let derivedKey=null, activeTable=null;

async function decryptTable(ciphertext){
  const nonce=decode64(activeTable.nonce);
  const cryptoKey=await crypto.subtle.importKey('raw',derivedKey,'AES-GCM',false,['decrypt']); derivedKey.fill(0); derivedKey=null;
  const aad=encoder.encode(`john-ao-database-v1\0${activeTable.name}`);
  const decrypted=await crypto.subtle.decrypt({name:'AES-GCM',iv:nonce,additionalData:aad},cryptoKey,ciphertext);
  self.postMessage({type:'stage',stage:'decompress'});
  const plain=await gunzip(new Uint8Array(decrypted));
  self.postMessage({type:'stage',stage:'parse'});
  const parsed=parseTsv(new TextDecoder('utf-8',{fatal:true}).decode(plain)); plain.fill(0);
  self.database=parsed;
  self.postMessage({type:'ready',columns:parsed.columns,rowCount:parsed.rows.length});
}

self.onmessage=async({data})=>{
  try{
    if(data.type==='derive'){
      activeTable=data.table;
      const password=encoder.encode(data.password); data.password='';
      const salt=decode64(data.table.salt);
      const load=await loadArgon2id();
      derivedKey=load({password,salt,parallelism:data.table.kdf.parallelism,passes:data.table.kdf.passes,
        memorySize:data.table.kdf.memoryKiB,tagLength:data.table.kdf.keyBytes});
      password.fill(0);
      self.postMessage({type:'derived'});
    } else if(data.type==='public'){
      self.postMessage({type:'stage',stage:'parse'});
      const plain=new Uint8Array(data.contents);
      const parsed=parseTsv(new TextDecoder('utf-8',{fatal:true}).decode(plain)); plain.fill(0);
      self.database=parsed;
      self.postMessage({type:'ready',columns:parsed.columns,rowCount:parsed.rows.length});
    } else if(data.type==='ciphertext'){
      await decryptTable(data.ciphertext);
    } else if(data.type==='rows'){
      const indexes=data.useSearch?self.searchIndexes:null, out=[];
      for(let i=data.start;i<data.end;i++){
        const original=indexes?indexes[i]:i; if(original===undefined) break;
        out.push({index:original,row:self.database.rows[original]});
      }
      self.postMessage({type:'rows',requestId:data.requestId,start:data.start,rows:out});
    } else if(data.type==='search'){
      const tests=data.conditions.map(c=>({column:c.column,test:compile(c)})),matches=[];
      for(let i=0;i<self.database.rows.length;i++){
        const row=self.database.rows[i];
        if(tests.every(item=>item.test.test(row[item.column]??''))) matches.push(i);
        if(i%25000===0) self.postMessage({type:'search-progress',scanned:i,total:self.database.rows.length});
      }
      self.searchIndexes=matches;
      self.postMessage({type:'search-result',count:matches.length});
    }
  }catch(error){
    self.postMessage({type:'error',message:error?.name==='OperationError'?'密码错误或数据已损坏':String(error?.message||error)});
  }
};
