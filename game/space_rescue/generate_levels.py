"""Generate original puzzles; validate shortest solutions with breadth-first search."""
import random,json
from collections import deque
random.seed(20261020)
D=[(0,-1),(1,0),(0,1),(-1,0)]
def move(s,i,d):
 x,y=s[i]%7,s[i]//7;dx,dy=D[d];hits=[]
 for j,p in enumerate(s):
  if j==i:continue
  a,b=p%7-x,p//7-y
  if (dx==0 and a==0 and b*dy>0) or (dy==0 and b==0 and a*dx>0):hits.append(abs(a)+abs(b))
 if not hits or min(hits)==1:return
 t=list(s);n=min(hits)-1;t[i]=x+dx*n+7*(y+dy*n);return tuple(t)
def solve(s):
 q=deque([s]);prev={s:None}
 while q and len(prev)<90000:
  p=q.popleft()
  if p[0]==24:
   path=[]
   while prev[p]:
    old,i,d=prev[p];path.append([i,d]);p=old
   return path[::-1]
  for i in range(len(p)):
   for d in range(4):
    t=move(p,i,d)
    if t and t not in prev:prev[t]=(p,i,d);q.append(t)
levels=[]
for target in [2,3,4,4,5,5,6,6,7,7,8,9]:
 for attempt in range(3000):
  s=tuple(random.sample([i for i in range(49) if i!=24],5));path=solve(s)
  if path and len(path)==target:
   levels.append({'pieces':s,'solution':path,'par':len(path)});print(target,s,flush=True);break
 else:raise RuntimeError(target)
open('levels.js','w').write('const LEVELS = '+json.dumps(levels)+';\nif (typeof module !== "undefined") module.exports = LEVELS;\n')
