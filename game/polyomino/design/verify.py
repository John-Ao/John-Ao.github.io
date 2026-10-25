"""Recount all screened levels independently of the saved answer."""
import json
from pathlib import Path
from generate import solve
catalog=json.loads(Path(__file__).with_name('catalog.json').read_text())
for i,l in enumerate(catalog['levels'],1):
 if l['complete']:
  sols,nodes,cut=solve(set(map(tuple,l['cells'])),[p[0] for p in l['defs']],limit=l['solutions']+1,budget=1000000)
  assert not cut and len(sols)==l['solutions'],(i,len(sols),cut)
  print(i,l['name'],len(sols),'placements (whole-board symmetries counted)')
print('PASS: exhaustive solution counts for',sum(l['complete'] for l in catalog['levels']),'screened levels')
