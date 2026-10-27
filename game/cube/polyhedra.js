/* Convex-piece models; cuts and legal moves use the same geometric planes. */
(function(root){
'use strict';
const EPS=1e-6,TAU=2*Math.PI;
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=a=>mul(a,1/Math.hypot(...a));
const average=ps=>mul(ps.reduce(add,[0,0,0]),1/ps.length);
const rotate=(p,n,t)=>add(add(mul(p,Math.cos(t)),mul(cross(n,p),Math.sin(t))),mul(n,dot(n,p)*(1-Math.cos(t))));
const unique=ps=>ps.filter((p,i)=>!ps.slice(0,i).some(q=>Math.hypot(...sub(p,q))<EPS));
function ordered(ps,n){const c=average(ps),u=norm(sub(ps[0],c)),v=cross(n,u);return ps.sort((a,b)=>Math.atan2(dot(sub(a,c),v),dot(sub(a,c),u))-Math.atan2(dot(sub(b,c),v),dot(sub(b,c),u)));}
function shell(ns){const vs=[];for(let i=0;i<ns.length;i++)for(let j=i+1;j<ns.length;j++)for(let k=j+1;k<ns.length;k++){
 const [a,b,c]=[ns[i],ns[j],ns[k]],d=dot(a,cross(b,c));if(Math.abs(d)<EPS)continue;
 const p=mul(add(add(cross(b,c),cross(c,a)),cross(a,b)),1/d);if(ns.every(n=>dot(n,p)<=1+EPS))vs.push(p);
}return ns.map((n,color)=>({color,points:ordered(unique(vs.filter(p=>Math.abs(dot(n,p)-1)<EPS)),n)}));}
function clip(faces,n,d){const result=[],cuts=[];for(const f of faces){const ps=[];for(let i=0;i<f.points.length;i++){
 const a=f.points[i],b=f.points[(i+1)%f.points.length],da=dot(a,n)-d,db=dot(b,n)-d;if(da<=EPS)ps.push(a);if(Math.abs(da)<=EPS)cuts.push(a);
 if((da < -EPS&&db>EPS)||(da>EPS&&db < -EPS)){const p=add(a,mul(sub(b,a),da/(da-db)));ps.push(p);cuts.push(p);}
 }const clean=unique(ps);if(clean.length>=3)result.push({color:f.color,points:clean});}
 const cap=unique(cuts);if(cap.length>=3)result.push({color:-1,points:ordered(cap,n)});return result;}
const cubeNormals=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
const tetra=[[1,1,1],[1,-1,-1],[-1,1,-1],[-1,-1,1]].map(norm);
const phi=(1+Math.sqrt(5))/2,mega=[];for(const a of [-1,1])for(const b of [-1,1])mega.push(norm([0,a,b*phi]),norm([a,b*phi,0]),norm([b*phi,0,a]));
const octa=[...tetra,...tetra.map(n=>mul(n,-1))];
const icosa=octa.map(n=>n.slice());
for(const a of [-1,1])for(const b of [-1,1])icosa.push(norm([0,a/phi,b*phi]),norm([a*phi,0,b/phi]),norm([a/phi,b*phi,0]));
const orders={pyraminx:[2,3,4,5],megaminx:[3,5,7],skewb:[3,5,7],octahedron:[3,5],icosahedron:[3,5],sq1:[]};
function valid(type,order){return Object.hasOwn(orders,type)&&(orders[type].length?orders[type].includes(order):order===3);}
function config(type,order){if(!valid(type,order))throw Error('无效魔方类型或阶数');
 if(type==='pyraminx')return {normals:tetra.map(n=>mul(n,-1)),axes:tetra,cuts:Array.from({length:order-1},(_,i)=>-1+4*(i+1)/order),step:TAU/3};
 if(type==='megaminx')return {normals:mega,axes:mega,cuts:Array.from({length:(order-1)/2},(_,i)=>1-(i+1)*(1-Math.sqrt(5)/3)/((order-1)/2)),step:TAU/5};
 if(type==='skewb')return {normals:cubeNormals,axes:tetra,cuts:Array.from({length:order-2},(_,i)=>Math.ceil(i/2)*(i%2?1:-1)*.4),step:TAU/3};
 if(type==='octahedron'||type==='icosahedron'){const normals=type==='octahedron'?octa:icosa;return {normals,axes:normals,cuts:Array.from({length:(order-1)/2},(_,i)=>1-(i+1)*.25/((order-1)/2)),step:TAU/3};}
 return {normals:cubeNormals,axes:[[0,1,0],[0,-1,0],[1,0,0]],cuts:[.5],step:Math.PI/6};
}
function create(type,order=3){const c=config(type,order);let cells=[shell(c.normals)];
 if(type==='sq1'){
  const body=cells[0];cells=[];
  for(const sign of [-1,1]){let angle=0;for(let i=0;i<8;i++){const next=angle+(i%2?1:2)*Math.PI/6;
   let fs=clip(body,[0,-sign,0],-.5);fs=clip(fs,[Math.sin(angle),0,-Math.cos(angle)],0);fs=clip(fs,[-Math.sin(next),0,Math.cos(next)],0);cells.push(fs);angle=next;
  }}
  let mid=clip(clip(body,[0,1,0],.5),[0,-1,0],.5);for(const sign of [-1,1])cells.push(clip(mid,[sign,0,0],0));
 }else for(const n of c.axes)for(const d of c.cuts){const next=[];for(const fs of cells){const ds=fs.flatMap(f=>f.points.map(p=>dot(p,n)-d));if(Math.min(...ds)<-EPS&&Math.max(...ds)>EPS)next.push(clip(fs,n,d),clip(fs,mul(n,-1),-d));else next.push(fs);}cells=next;}
 return cells.filter(fs=>fs.some(f=>f.color>=0)).map((faces,id)=>({id,faces}));
}
function selection(pieces,type,order,axis,layer){const c=config(type,order);if(!Number.isInteger(axis)||axis<0||axis>=c.axes.length||!Number.isInteger(layer)||layer<0||layer>=(type==='sq1'?1:c.cuts.length))return null;
 const n=c.axes[axis],d=type==='sq1'?(axis===2?0:.5):c.cuts[layer],ids=[];
 for(const p of pieces){const ds=p.faces.flatMap(f=>f.points.map(v=>dot(v,n)-d));if(Math.max(...ds)<=EPS)continue;if(Math.min(...ds)<-EPS)return null;ids.push(p.id);}return ids.length?ids:null;
}
function step(type,order,axis){return type==='sq1'&&axis===2?Math.PI:config(type,order).step;}
function turn(pieces,type,order,axis,layer,dir){const ids=selection(pieces,type,order,axis,layer);if(!ids||![-1,1].includes(dir))throw Error('当前切面被块阻挡');const set=new Set(ids),c=config(type,order);for(const p of pieces)if(set.has(p.id))for(const f of p.faces)f.points=f.points.map(v=>rotate(v,c.axes[axis],step(type,order,axis)*dir));}
function solved(pieces,type,order){const ns=config(type,order).normals;return pieces.every(p=>p.faces.every(f=>f.color<0||f.points.every(v=>Math.abs(dot(v,ns[f.color])-1)<1e-5)));}
function legalMoves(pieces,type,order){const c=config(type,order),out=[];for(let a=0;a<c.axes.length;a++)for(let l=0;l<(type==='sq1'?1:c.cuts.length);l++)if(selection(pieces,type,order,a,l))out.push([a,l]);return out;}
const api={shell,orders,valid,config,create,selection,step,turn,solved,legalMoves,rotate,average,norm,cross,sub,dot};if(typeof module!=='undefined')module.exports=api;else root.PolyPuzzle=api;
})(globalThis);
