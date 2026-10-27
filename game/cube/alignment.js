'use strict';
function polyAlignment(){return ['pyraminx','octahedron','megaminx','icosahedron'].includes(puzzleType);}
function alignmentModes(){return ['octahedron','megaminx','icosahedron'].includes(puzzleType)?[0,1]:[0,1,2,3];}
function alignmentGeometry(){
 const normals=P.config(puzzleType,order).normals,faces=P.shell(normals),vertices=[];
 for(const face of faces)for(const v of face.points)if(!vertices.some(w=>Math.hypot(...P.sub(v,w))<1e-6))vertices.push(v);
 return {normals,faces,vertices};
}
function alignmentCandidates(mode){
 if(!polyAlignment()){
  const base=pose(mode),out=[],directions=[...M.axes,...M.axes.map(v=>v.map(n=>-n))];
  for(const front of directions)for(const up of directions)if(M.dot(front,up)===0)out.push(multiply(base,[M.cross(up,front),up,front]));
  return out;
 }
 const key=puzzleType+':'+mode,cache=alignmentCandidates.cache||(alignmentCandidates.cache=new Map());if(cache.has(key))return cache.get(key);
 const {normals,faces,vertices}=alignmentGeometry(),targets=[];
 if(mode===1)normals.forEach((front,i)=>targets.push({front,anchors:faces[i].points}));
 else if(mode===2){
  for(let i=0;i<normals.length;i++)for(let j=i+1;j<normals.length;j++){
   const shared=vertices.filter(v=>Math.abs(P.dot(v,normals[i])-1)<1e-6&&Math.abs(P.dot(v,normals[j])-1)<1e-6);
   if(shared.length===2)targets.push({front:P.norm(normals[i].map((v,k)=>v+normals[j][k])),anchors:shared});
  }
 }else for(const vertex of vertices)targets.push({front:P.norm(vertex),anchors:vertices.filter(v=>v!==vertex)});
 const out=[];
 for(const {front,anchors}of targets)for(const anchor of anchors){
  const tangent=anchor.map((v,i)=>v-front[i]*P.dot(anchor,front));if(Math.hypot(...tangent)<1e-6)continue;
  const up=P.norm(tangent);out.push([P.norm(P.cross(up,front)),up,front]);
 }
 cache.set(key,out);return out;
}
function alignmentIcon(mode){
 if(!polyAlignment())return cubeIcon(mode);
 const {normals,faces}=alignmentGeometry(),basis=alignmentCandidates(mode|| (puzzleType==='pyraminx'?3:1))[0],edges=new Map();
 faces.forEach((face,i)=>{if(P.dot(normals[i],basis[2])<=1e-6)return;face.points.forEach((a,j)=>{const b=face.points[(j+1)%face.points.length],key=[a,b].map(v=>v.map(x=>Math.round(x*1e6)).join()).sort().join('|');edges.set(key,[a,b]);});});
 const points=[...edges.values()].flat().map(v=>[P.dot(basis[0],v),-P.dot(basis[1],v)]),extent=Math.max(...points.flat().map(Math.abs)),scale=17/extent;
 const project=v=>[24+P.dot(basis[0],v)*scale,24-P.dot(basis[1],v)*scale];
 const paths=[...edges.values()].map(([a,b])=>`<path d="M${project(a).join(' ')}L${project(b).join(' ')}"/>`).join('');
 return `<svg viewBox="0 0 48 48" aria-hidden="true">${paths}${mode===0?'<path d="M6 42L42 6" stroke-width="3"/>':''}</svg>`;
}
function syncAlignmentUI(){
 const modes=alignmentModes(),normalized=!modes.includes(align);if(normalized)align=1;
 const labels=puzzleType==='pyraminx'?['关闭角度对齐','单面对齐','双面对齐','三面对齐']:['关闭角度对齐','正对','2/3 正面 + 1/3 顶面','正面 + 上面 + 右面'];
 $('align-options').replaceChildren();
 for(const mode of modes){const button=document.createElement('button');button.title=labels[mode];button.setAttribute('aria-label',labels[mode]);button.setAttribute('aria-pressed',String(align===mode));button.dataset.mode=mode;button.innerHTML=alignmentIcon(mode);
  button.onclick=()=>{align=mode;snap=null;for(const b of $('align-options').children)b.setAttribute('aria-pressed',String(Number(b.dataset.mode)===mode));snapView();save();};$('align-options').append(button);
 }
 if(normalized)snapView();
}
