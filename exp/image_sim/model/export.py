"""Convert official PyTorch weights to float32 NHWC kernels.
Usage: python export.py backbone.pth calibration.pth
Backbone: https://download.pytorch.org/models/squeezenet1_1-b8a52dc0.pth
Calibration: https://github.com/richzhang/PerceptualSimilarity/blob/master/lpips/weights/v0.1/squeeze.pth
Licenses: TORCHVISION-LICENSE and LPIPS-LICENSE in this directory.
"""
import json, sys
from pathlib import Path
import torch
import numpy as np
out = Path(__file__).parent
spec, offset = {}, 0
with (out / 'weights.bin').open('wb') as f:
    for filename in sys.argv[1:]:
        state = torch.load(filename, map_location='cpu', weights_only=True)
        for name, tensor in state.items():
            if name.startswith('classifier'): continue
            a = tensor.numpy()
            if a.ndim == 4: a = a.transpose(2,3,1,0)
            a = np.ascontiguousarray(a, dtype='<f4')
            spec[name] = {'shape': list(a.shape), 'offset': offset, 'size': a.size}
            f.write(a.tobytes())
            offset += a.size
(out / 'weights.json').write_text(json.dumps(spec))
