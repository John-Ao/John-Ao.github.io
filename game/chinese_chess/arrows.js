// Board coordinates use 100 units between neighboring intersections.
export function analysisArrows(results,point,selected=false){
 return results.map((r,i)=>{
  const [x,y]=point(r.from),[tx,ty]=point(r.to);
  const length=Math.hypot(tx-x,ty-y);
  if(!length)return '';
  const ux=(tx-x)/length,uy=(ty-y)/length;
  const startInset=Math.min(22,length*.22),endInset=Math.min(18,length*.18);
  const headLength=Math.min(24,length*.24),headWidth=12;
  const tipX=tx-ux*endInset,tipY=ty-uy*endInset;
  const baseX=tipX-ux*headLength,baseY=tipY-uy*headLength;
  const color=r.score>=0?'#31775b':'#b25144';
  // A single recommendation needs no rank badge. For multiple lines, place
  // the badge beside the shaft so it cannot cover a one-step arrowhead.
  const badgeX=x+ux*length*.5-uy*30,badgeY=y+uy*length*.5+ux*30;
  const badge=results.length>1?`<circle cx="${badgeX}" cy="${badgeY}" r="14" fill="${color}" stroke="#fff5e4" stroke-width="2"/><text x="${badgeX}" y="${badgeY+5}" text-anchor="middle" font-size="16" fill="white">${i+1}</text>`:'';
  return `<g opacity="${selected?.3:.85}"><path d="M${x+ux*startInset} ${y+uy*startInset}L${baseX} ${baseY}" fill="none" stroke="${color}" stroke-width="${i===0?9:6}" stroke-linecap="round"/><path d="M${tipX} ${tipY}L${baseX-uy*headWidth} ${baseY+ux*headWidth}L${baseX+uy*headWidth} ${baseY-ux*headWidth}Z" fill="${color}"/>${badge}</g>`;
 }).join('');
}
