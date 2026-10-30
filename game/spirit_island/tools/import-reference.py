"""Extract factual metadata from a locally downloaded SICK reference, never execute it.
Usage: python tools/import-reference.py /tmp/si-db.ts
Generated text/effects are authored separately in powers.js.
"""
import re,json,sys,pathlib
text=pathlib.Path(sys.argv[1]).read_text()
pat=re.compile(r'"(?:\\.|[^"\\])*"|-?\d+|[A-Za-z_][A-Za-z_0-9.]*|[\[\](),]')
def extract(kind):
 result=[]
 for m in re.finditer(r'new '+kind+r'\(ProductSet.Basegame,',text):
  tokens=pat.findall(text[m.end()-len('ProductSet.Basegame,'):]);pos=0
  def val():
   nonlocal pos
   t=tokens[pos];pos+=1
   if t=='[':
    a=[]
    while tokens[pos]!=']':
     a.append(val())
     if tokens[pos]==',':pos+=1
    pos+=1;return a
   if t=='new':
    typ=tokens[pos];pos+=2;a=[]
    while tokens[pos]!=')':
     a.append(val())
     if tokens[pos]==',':pos+=1
    pos+=1;return {'source':a[0],'range':a[1], 'terrain':a[2] if len(a)>2 else None}
   if t[0]=='"':return json.loads(t)
   if t=='null':return None
   if t.isdigit():return int(t)
   return t.split('.')[-1]
  a=[]
  while tokens[pos]!=')':
   a.append(val())
   if tokens[pos]==',':pos+=1
  result.append(a)
 return result
powers=[]
for a in extract('PowerCard'):
 if a[1] not in ['Minor','Major','LightningsSwiftStrike','RiverSurgesInSunlight','VitalStrengthOfTheEarth','ShadowsFlickerLikeFlame']:continue
 powers.append(dict(id=len(powers),kind=a[1],name=a[2],cost=a[3],speed=a[4].lower(),origin=a[5],target=a[6],elements=[x.lower() for x in a[7]]))
# Names and factual parameters only. Card prose is not copied.
out='/* Card metadata: SICK / official base-game cards; see SOURCES.md. */\n(function(r){const data='+json.dumps(powers,ensure_ascii=False,separators=(',',':'))+';r.SICards=data;if(typeof module!=="undefined")module.exports=data;})(typeof window!=="undefined"?window:globalThis);\n'
pathlib.Path('cards.js').write_text(out)
print(len(powers),'cards', {k:sum(c['kind']==k for c in powers) for k in ['Minor','Major']})
pathlib.Path('/tmp/si-base-cards-reference.json').write_text(json.dumps(extract('PowerCard'),ensure_ascii=False,indent=2))
