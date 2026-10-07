// Wait for isolation before starting the board, so the first automatic reload
// cannot discard a move. The full URL (including shared history) is preserved.
async function prepareIsolation(){
 const marker='chinese-chess-isolation:'+new URL('.',import.meta.url).pathname;
 if(globalThis.crossOriginIsolated){try{sessionStorage.removeItem(marker);}catch{}return true;}
 if(!globalThis.isSecureContext||!('serviceWorker' in navigator))return true;
 let timer;
 try{
  await Promise.race([
   (async()=>{
    await navigator.serviceWorker.register(new URL('./isolation-worker.js',import.meta.url),{scope:'./',updateViaCache:'none'});
    await navigator.serviceWorker.ready;
    if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));
   })(),
   new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Service Worker timeout')),10000);})
  ]);
  // At most one automatic reload per tab, even if browser policy blocks isolation.
  if(sessionStorage.getItem(marker))return true;
  sessionStorage.setItem(marker,'1');
  location.reload();return false;
 }catch{return true;}finally{clearTimeout(timer);}
}
if(await prepareIsolation())await import('./app.js');
