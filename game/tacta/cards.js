/* Geometric transcription of publisher photos and rulebook diagrams.
 * No original artwork is bundled. See RESEARCH.md for evidence and limits.
 * Units are normalized to a 100-wide printed outline, not physical millimetres.
 */
(function (root) {
  'use strict';
  const W = 100, H = 143, LEG = 45, HALF = LEG / Math.sqrt(2), STRIP = 22;
  const rect = (x, y, w, h) => [[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
  const shapes = {
    squareTL: rect(0,0,50,50),
    cornerTR: [[W-LEG,0],[W,0],[W,LEG]],
    cornerBR: [[W,H-LEG],[W,H],[W-LEG,H]],
    cornerTL: [[0,0],[LEG,0],[0,LEG]],
    cornerBL: [[0,H-LEG],[LEG,H],[0,H]],
    top: [[W/2-HALF,0],[W/2+HALF,0],[W/2,HALF]],
    bottom: [[W/2,H-HALF],[W/2+HALF,H],[W/2-HALF,H]],
    left: [[0,H/2-HALF],[HALF,H/2],[0,H/2+HALF]],
    right: [[W,H/2-HALF],[W,H/2+HALF],[W-HALF,H/2]],
    shortBottom: rect(0,H-STRIP,W,STRIP),
    middleLeft: rect(0,(H-W)/2,STRIP,W),
    middleRight: rect(W-STRIP,(H-W)/2,STRIP,W),
    longLeft: rect(0,0,STRIP,H),
  };
  const templates = {
    A: ['squareTL','right','shortBottom'],
    B: ['top','middleLeft','cornerBR'],
    C: ['cornerTR','left','shortBottom'],
    D: ['squareTL','cornerTR','bottom'],
    F: ['longLeft','cornerTR','cornerBR'],
    G: ['top','left','bottom','middleRight'],
    H: ['longLeft','cornerTR','cornerBR'],
    J: ['cornerTR','bottom','left'],
  };
  // Explicit card records replace the old procedural, arbitrary 2×2 deck.
  // "partial" means the source does not reveal every part of that card.
  const records = [
    ['square',1,'A',[0,1,0],'rulebook'],
    ['square',2,'A',[2,0,0],'rulebook'],
    ['square',3,'A',[2,1,0],'partial'],
    ['square',4,'B',[1,3,0],'partial'],
    ['square',5,'A',[2,0,3],'partial'],
    ['square',6,'A',[2,1,3],'partial'],
    ['circle',1,'B',[1,0,0],'partial'],
    ['circle',2,'D',[0,1,1],'partial'],
    ['circle',3,'C',[0,0,3],'rulebook'],
    ['circle',4,'F',[4,0,0],'photo'],
    ['circle',5,'B',[1,3,1],'rulebook'],
    ['circle',6,'G',[1,1,1,3],'rulebook'],
    ['triangle',1,'D',[0,1,0],'partial'],
    ['triangle',2,'J',[1,1,0],'photo'],
    ['triangle',3,'B',[0,3,0],'rulebook'],
    ['triangle',4,'C',[1,0,3],'photo'],
    ['triangle',5,'H',[4,1,0],'partial'],
    ['triangle',6,'F',[4,1,1],'photo'],
  ];
  function region(name, count, id) {
    const polygon = shapes[name].map(p => [...p]);
    const cx = polygon.reduce((s,p)=>s+p[0],0)/polygon.length;
    const cy = polygon.reduce((s,p)=>s+p[1],0)/polygon.length;
    let dots = [];
    if (count) {
      if (name === 'squareTL') dots = [[15,15],[35,35]].slice(0,count);
      else if (name.includes('Left') || name.includes('Right')) {
        const a = Math.min(...polygon.map(p=>p[1])), b = Math.max(...polygon.map(p=>p[1]));
        dots = Array.from({length:count},(_,i)=>[cx,a+(b-a)*(i+1)/(count+1)]);
      } else if (name === 'shortBottom') dots = Array.from({length:count},(_,i)=>[W*(i+1)/(count+1),cy]);
      else dots = [[cx,cy]];
    }
    return {id, name, polygon, dots, kind: polygon.length===3?'triangle':name.startsWith('square')?'square':'rectangle'};
  }
  const cards = records.map(([suit,value,template,counts,evidence]) => ({
    suit, value, evidence, template,
    regions: templates[template].map((name,i)=>region(name,counts[i],i)),
  }));
  function starter() {
    const regions = Object.keys(shapes).map((name,i)=>region(name,0,i));
    for (const [x,y] of [[50,0],[0,H-50],[50,H-50]]) regions.push({id:regions.length,name:'square',kind:'square',polygon:rect(x,y,50,50),dots:[]});
    for (const polygon of [rect(0,0,W,STRIP),rect(W-STRIP,0,STRIP,H)]) regions.push({id:regions.length,name:'rectangle',kind:'rectangle',polygon,dots:[]});
    return {id:'start',owner:-1,value:0,suit:'start',regions};
  }
  const api = {W,H,cards,starter};
  if (typeof module !== 'undefined') module.exports=api; else root.TactaCards=api;
})(typeof window==='undefined'?globalThis:window);
