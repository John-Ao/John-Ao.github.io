"""Deterministic exact-cover search. No external packages or downloaded puzzle data."""
import json, random, time
from pathlib import Path
R=random.Random(20261022)
SHAPES={
'I5':[(0,0),(1,0),(2,0),(3,0),(4,0)],'L5':[(0,0),(0,1),(0,2),(0,3),(1,3)],
'P':[(0,0),(1,0),(0,1),(1,1),(0,2)],'N':[(0,0),(0,1),(1,1),(1,2),(1,3)],
'T5':[(0,0),(1,0),(2,0),(1,1),(1,2)],'U':[(0,0),(2,0),(0,1),(1,1),(2,1)],
'V':[(0,0),(0,1),(0,2),(1,2),(2,2)],'W':[(0,0),(0,1),(1,1),(1,2),(2,2)],
'X':[(1,0),(0,1),(1,1),(2,1),(1,2)],'Y':[(0,0),(0,1),(0,2),(0,3),(1,1)],
'Z':[(0,0),(1,0),(1,1),(1,2),(2,2)],'F':[(1,0),(2,0),(0,1),(1,1),(1,2)]}
def orient(c,r,f):
 c=[(-x if f else x,y) for x,y in c]
 for _ in range(r):c=[(-y,x) for x,y in c]
 mx=min(x for x,y in c);my=min(y for x,y in c)
 return sorted((x-mx,y-my) for x,y in c)
OR={}
for t,c in SHAPES.items():
 seen=set();OR[t]=[]
 for f in [False,True]:
  for r in range(4):
   o=orient(c,r,f)
   if tuple(o) not in seen:seen.add(tuple(o));OR[t].append((o,r,f))
def solve(board,types,limit=65,budget=250000):
 cells=sorted(board);idx={p:i for i,p in enumerate(cells)};allmask=(1<<len(cells))-1;bycell=[[] for _ in cells];bypiece=[[] for _ in types]
 for i,t in enumerate(types):
  for c,r,f in OR[t]:
   for y in range(max(y for x,y in cells)+1):
    for x in range(max(x for x,y in cells)+1):
     pts=[(x+a,y+b) for a,b in c]
     if all(p in idx for p in pts):
      mask=sum(1<<idx[p] for p in pts);row=(mask,1<<i,(t,r,x,y,f));bypiece[i].append(row)
      for p in pts:bycell[idx[p]].append(row)
 solutions=[];nodes=0;cut=False
 def dfs(used,ps,path):
  nonlocal nodes,cut
  nodes+=1
  if nodes>budget:cut=True;return
  if used==allmask:solutions.append(path);return
  options=None
  bits=allmask^used
  while bits:
   bit=bits&-bits;bits-=bit
   opts=[row for row in bycell[bit.bit_length()-1] if not(row[0]&used or row[1]&ps)]
   if not opts:return
   if options is None or len(opts)<len(options):options=opts
   if len(options)==1:break
  for m,p,d in options:
   dfs(used|m,ps|p,path+[d])
   if len(solutions)>=limit or cut:return
 dfs(0,0,[])
 return solutions,nodes,cut
rect=lambda w,h:{(x,y) for y in range(h) for x in range(w)}
if __name__ == '__main__':
 # Geometry is selected before any piece packing; symmetric silhouettes avoid stray lobes.
 targets=[
  ('长方形',rect(5,4)),('方形',rect(5,5)),
  ('阶梯',{(x,y) for y,w in enumerate([3,4,5,6,7]) for x in range(w)}),
  ('矩形',rect(6,5)),('凹形',rect(7,5)-{(x,4) for x in range(1,6)}),
  ('切角',rect(8,6)-{(x,y) for x in [0,1,6,7] for y in [0,5]}),
  ('方环',rect(7,7)-{(x,y) for x in range(2,5) for y in range(2,5)}),
  ('宽矩形',rect(8,5)),
  ('十字',{(x,y) for y in range(9) for x in range(9) if 3<=x<=5 or 3<=y<=5}),
  ('阶台',{(x,y) for y,w in enumerate([5,7,9,9,7,5,3]) for x in range((9-w)//2,(9+w)//2)}),
  ('大矩形',rect(9,5))]
 targets.sort(key=lambda b:len(b[1]));out=[]
 for name,board in targets:
  n=len(board)//5
  assert len(board)%5==0,(name,len(board))
  candidates=[]
  for attempt in range(100):
   types=sorted(R.sample(list(SHAPES),n));sol,nodes,cut=solve(board,types)
   if sol and not cut and len(sol)<65:
    candidates.append((len(sol),-nodes,types,sol,nodes))
    if len(candidates)>=5:break
  if not candidates:
   first,_,_=solve(board,list(SHAPES),limit=1,budget=1000000)
   if not first:raise RuntimeError(('no candidate',name))
   types=sorted(d[0] for d in first[0]);sol,nodes,cut=solve(board,types,limit=100000,budget=1000000)
   if cut:raise RuntimeError(('count budget',name))
   candidates.append((len(sol),-nodes,types,sol,nodes))
  candidates.sort();cnt,_,types,sol,nodes=candidates[0]
  chosen=sol[0];R.shuffle(chosen)
  out.append(dict(name=name,cells=sorted(board),defs=chosen,solutions=cnt,nodes=nodes,complete=True))
  print(name,len(board),types,'solutions',cnt,'nodes',nodes,flush=True)
 for name,board in [('经典矩形',rect(10,6)),('中心方环',rect(8,8)-{(x,y) for x in [3,4] for y in [3,4]})]:
  sol,nodes,cut=solve(board,list(SHAPES),limit=1,budget=3000000)
  assert sol,name
  chosen=sol[0];R.shuffle(chosen);out.append(dict(name=name,cells=sorted(board),defs=chosen,solutions=None,nodes=nodes,complete=False))
  print(name,'first solution',nodes,flush=True)
 Path(__file__).with_name('catalog.json').write_text(json.dumps({'shapes':SHAPES,'levels':out},ensure_ascii=False,indent=2))
