'use strict';
(function(){
 const main=document.querySelector('main'),controls=document.querySelector('.controls');
 function fitDialogs(){
  document.querySelectorAll('dialog[open]').forEach(dialog=>{
   const width=Math.max(1,window.visualViewport?.width||innerWidth);
   const height=Math.max(1,window.visualViewport?.height||innerHeight);
   dialog.style.width=Math.min(480,Math.max(300,width-24))+'px';
   dialog.style.transform='none';
   const scale=Math.min(1,(width- Math.min(16,width/10))/dialog.offsetWidth,(height-Math.min(16,height/10))/dialog.offsetHeight);
   dialog.style.transform=`scale(${scale})`;
  });
 }
 window.fitGame=function(){
  const width=Math.max(1,window.visualViewport?.width||innerWidth);
  const height=Math.max(1,window.visualViewport?.height||innerHeight);
  // Below a usable layout size, scale the entire interface together, without clipping controls.
  const scale=Math.min(1,width/360,height/480),w=width/scale,h=height/scale;
  const availableW=w-16,availableH=h-16,gap=10,playerRows=96;
  main.style.width=w+'px';main.style.height=h+'px';main.style.transform=`scale(${scale})`;
  main.dataset.layout='column';
  main.style.setProperty('--controls-width',availableW+'px');
  const columnSize=Math.max(0,Math.min(availableW,availableH-playerRows-gap-controls.offsetHeight));
  main.dataset.layout='row';
  main.style.setProperty('--controls-width','230px');
  const rowSize=controls.offsetHeight<=availableH?Math.max(0,Math.min(availableW-230-gap,availableH-playerRows)):0;
  const row=rowSize>columnSize;
  const size=row?rowSize:columnSize;
  main.dataset.layout=row?'row':'column';
  main.style.setProperty('--board-size',size+'px');
  main.style.setProperty('--controls-width',(row?230:availableW)+'px');
  fitDialogs();
 };
 window.addEventListener('resize',window.fitGame);
 window.visualViewport?.addEventListener('resize',window.fitGame);
 new MutationObserver(fitDialogs).observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});
 window.fitGame();
})();
