"""Append compact, independently solved puzzles without changing published IDs."""
import json,random
from pathlib import Path
from generate import SHAPES,solve,rect
ROOT=Path(__file__).resolve().parent
rng=random.Random(20261026)
def signature(cells,types):
 # Treat rotated and mirrored versions of the same puzzle as duplicates.
 forms=[]
 for flip in (1,-1):
  points=[(x*flip,y) for x,y in cells]
  for _ in range(4):
   mx=min(x for x,y in points);my=min(y for x,y in points)
   forms.append(tuple(sorted((x-mx,y-my) for x,y in points)))
   points=[(-y,x) for x,y in points]
 return (min(forms),tuple(sorted(types)))
def main():
 data=json.loads((ROOT/'catalog.json').read_text());levels=data['levels'];seen={signature(l['cells'],[d[0] for d in l['defs']]) for l in levels}
 # Compact silhouettes, with up to two distinct piece sets per target.
 targets=[
  ('短条',rect(4,5)),
  ('错层', {(x+y//2,y) for y in range(4) for x in range(5)}),
  ('梯台', {(x,y) for y,w in enumerate([3,4,5,6,7]) for x in range(w)}),
  ('长斜带', {(x+y//2,y) for y in range(6) for x in range(5)}),
  ('宽桥',rect(8,5)-{(x,y) for x in range(3,5) for y in range(1,5)}-{(0,0),(7,0)}),
  ('侧窗',rect(7,5)-{(x,y) for x in range(1,6) for y in [2]}),
  ('双凹',rect(8,5)-{(x,y) for x in range(2,7) for y in [0,4]}),
  ('窄条',rect(5,3)),
  ('折角',rect(6,4)-{(x,y) for x in [4,5] for y in [0,1]}),
  ('双阶', {(x,y) for y,w in enumerate([3,3,4,5,5]) for x in range(w)}),
  ('桥形',rect(7,5)-{(x,y) for x in range(1,6) for y in [3,4]}),
  ('斜带', {(x+y//2,y) for y in range(5) for x in range(5)}),
  ('台阶', {(x,y) for y,w in enumerate([2,4,4,6,7,7]) for x in range(w)}),
  ('双缺角',rect(6,6)-{(0,0),(1,0),(0,1),(5,5),(5,4),(4,5)}),
  ('偏心方环',rect(7,6)-{(x,y) for x in range(2,4) for y in range(1,4)}-{(0,0)}),
  ('四角台',rect(7,7)-{(x,y) for x in range(7) for y in range(7) if (x in [0,6] and y in [0,1,5,6]) or (y in [0,6] and x in [1,5])}-{(3,0),(3,6)}),
  ('双窗',rect(8,6)-{(x,y) for x in [2,5] for y in [2,3]}-{(0,0),(7,0),(0,5),(7,5)}),
  ('宽阶', {(x,y) for y,w in enumerate([4,5,6,7,8,8,7]) for x in range(w)})]

 additions=[]
 for name,board in targets:
  n=len(board)//5;assert len(board)%5==0
  candidates=[];attempted=set()
  for _ in range(120):
   types=sorted(rng.sample(list(SHAPES),n));sig=signature(board,types)
   if sig in seen or sig in attempted:continue
   attempted.add(sig)
   sol,nodes,cut=solve(board,types,limit=33,budget=60000)
   if sol and not cut and len(sol)<33:
    candidates.append((len(sol),-nodes,types,sol[0],nodes))
    if len(candidates)>=4:break
  for count,_,types,answer,nodes in sorted(candidates)[:2]:
   rng.shuffle(answer);seen.add(signature(board,types))
   additions.append(dict(name=name,cells=sorted(board),defs=answer,solutions=count,nodes=nodes,complete=True,maxSide=8))
   print(name,len(board),count,nodes,flush=True)
 additions.sort(key=lambda l:(len(l['defs']),l['nodes']))
 assert len(additions)>=28,len(additions)
 levels.extend(additions)
 (ROOT/'catalog.json').write_text(json.dumps(data,ensure_ascii=False,indent=2))
 # Update only the embedded catalog, leaving legacy IDs and application logic intact.
 p=ROOT.parent/'app.js';s=p.read_text();start=s.index('const CATALOG=');end=s.index(';\nconst LEVELS=',start)
 s=s[:start]+'const CATALOG='+json.dumps(levels,ensure_ascii=False,separators=(',',':'))+s[end:];p.write_text(s)
 print('Added',len(additions),'Total',len(levels),flush=True)
if __name__=='__main__':main()
