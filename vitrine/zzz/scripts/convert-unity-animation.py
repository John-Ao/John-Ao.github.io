"""Bind exported Unity transform curves to the matching Assimp glTF skeleton.
Preserves authored cubic tangents; reflects X for Unity -> glTF handedness.
Requires PyYAML, NumPy, SciPy, Pillow. Does not invent or retarget animation.
"""
import argparse,json,struct,pathlib
import yaml,numpy as np
from scipy.spatial.transform import Rotation
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('model',type=pathlib.Path);p.add_argument('clip',type=pathlib.Path);p.add_argument('output',type=pathlib.Path);args=p.parse_args()
g=json.loads(args.model.read_text());clip=yaml.load('\n'.join(args.clip.read_text().splitlines()[3:]),Loader=yaml.CSafeLoader)['AnimationClip']
assert len(g['buffers'])==1
buf=bytearray((args.model.parent/g['buffers'][0]['uri']).read_bytes());paths={}
def visit(i,path):
 n=g['nodes'][i];paths[path]=i
 for child in n.get('children',[]):visit(child,(path+'/' if path else '')+g['nodes'][child]['name'])
visit(1,'')
def acc(values,typ):
 while len(buf)%4:buf.append(0)
 flat=np.array(values,dtype='<f4');offset=len(buf);buf.extend(flat.tobytes());v=len(g['bufferViews']);g['bufferViews'].append(dict(buffer=0,byteOffset=offset,byteLength=flat.nbytes))
 a=dict(bufferView=v,componentType=5126,count=len(values),type=typ)
 if typ=='SCALAR':a.update(min=[float(flat.min())],max=[float(flat.max())])
 i=len(g['accessors']);g['accessors'].append(a);return i
animation=dict(name=clip['m_Name'],samplers=[],channels=[]);missing=[]
for field,target,axes,sign in [('m_RotationCurves','rotation','xyzw',[1,-1,-1,1]),('m_PositionCurves','translation','xyz',[-1,1,1]),('m_ScaleCurves','scale','xyz',[1,1,1])]:
 for track in clip[field]:
  path=track['path'];node=paths.get(path)
  if node is None:missing.append(path);continue
  n=g['nodes'][node]
  if 'matrix' in n:
   m=np.array(n.pop('matrix')).reshape(4,4).T;s=np.linalg.norm(m[:3,:3],axis=0);r=m[:3,:3]/s
   if np.linalg.det(r)<0:s[0]*=-1;r[:,0]*=-1
   n.update(translation=m[:3,3].tolist(),rotation=Rotation.from_matrix(r).as_quat().tolist(),scale=s.tolist())
  keys=track['curve']['m_Curve'];assert all(k.get('weightedMode',0)==0 for k in keys),'Weighted tangent not implemented'
  times=[k['time'] for k in keys];assert all(b>a for a,b in zip(times,times[1:]))
  values=[[k[t][axis]*sign[j] for j,axis in enumerate(axes)] for k in keys for t in ['inSlope','value','outSlope']]
  assert np.isfinite(values).all()
  sampler=len(animation['samplers']);animation['samplers'].append(dict(input=acc(times,'SCALAR'),output=acc(values,'VEC'+str(len(axes))),interpolation='CUBICSPLINE'))
  animation['channels'].append(dict(sampler=sampler,target=dict(node=node,path=target)))
assert not missing,missing
g['animations']=[animation];g['buffers']=[dict(uri=args.output.with_suffix('.bin').name,byteLength=len(buf))]
args.output.write_text(json.dumps(g,separators=(',',':')));args.output.with_suffix('.bin').write_bytes(buf)
report=dict(clip=clip['m_Name'],channels=len(animation['channels']),unboundPaths=missing,sourceSampleRate=clip['m_SampleRate'],duration=clip['m_AnimationClipSettings']['m_StopTime'],omittedFloatCurves=len(clip['m_FloatCurves']),note='Transform curves only; facial blendshape channels not yet mapped. No retargeting or synthesized keys.')
args.output.with_suffix('.conversion.json').write_text(json.dumps(report,indent=2));print(report)
