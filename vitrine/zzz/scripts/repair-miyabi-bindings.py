"""Restore rigid weapon binding using root bones from the source Unity prefab.
The public FBX has empty weight arrays for these parts. This is a documented
rigid attachment fallback, not recovery of the missing per-vertex weights.
"""
import json,pathlib,numpy as np
root=pathlib.Path(__file__).resolve().parents[1]/'assets/models/miyabi'
g=json.loads((root/'idle.gltf').read_text());b=bytearray((root/'idle.bin').read_bytes())
roots={'Unagi_Weapon01':'Bn_katana_hilt','Unagi_Weapon02':'Bn_Weapon','Unagi_Weapon04':'Bn_katana_hilt','Unagi_Weapon05':'Bn_katana_hilt'}
joints={g['nodes'][n]['name']:i for i,n in enumerate(g['skins'][0]['joints'])}
def arr(index,dtype):
 a=g['accessors'][index];v=g['bufferViews'][a['bufferView']]
 return np.frombuffer(b,dtype=dtype,count=a['count']*4,offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,4)
for m in g['meshes']:
 if m['name'] not in roots:continue
 p=m['primitives'][0];w=arr(p['attributes']['WEIGHTS_0'],'<f4');j=arr(p['attributes']['JOINTS_0'],'<u2');assert not np.any(w)
 w[:,0]=1;j[:,0]=joints[roots[m['name']]]
 g['accessors'][p['attributes']['WEIGHTS_0']].update(min=w.min(axis=0).tolist(),max=w.max(axis=0).tolist())
 g['accessors'][p['attributes']['JOINTS_0']].update(min=j.min(axis=0).tolist(),max=j.max(axis=0).tolist())
for n in g['nodes']:
 if n['name'] in ['Unagi_PET','Unagi_Weapon03'] and 'mesh' in n:
  n['extras']={'sourcePrefabInactive':True,'excludedMesh':n.pop('mesh')};n.pop('skin',None)
(root/'idle.bin').write_bytes(b);(root/'idle.gltf').write_text(json.dumps(g,separators=(',',':')))
(root/'binding-repair.json').write_text(json.dumps({'scope':'rigid fallback; original per-vertex weapon weights absent','roots':roots,'source':'source.prefab','inactive':['Unagi_PET','Unagi_Weapon03']},indent=2))
