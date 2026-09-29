"""Validate persisted POC frames; outputs integrity evidence, not accuracy metrics."""
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent

def verify(name):
    path = ROOT / 'data' / name
    data = json.loads(path.read_text())
    cameras = []
    for camera in data['cameras']:
        frames = camera['frames']
        assert camera['status'] == 'ok', camera['id']
        assert len(frames) == data['captureRequestedSeconds'] * data['sampleFps']
        assert all(b['t'] > a['t'] for a, b in zip(frames, frames[1:]))
        for frame in frames:
            image_path = (ROOT / frame['imageUrl']).resolve()
            assert image_path.is_relative_to(ROOT / 'data')
            with Image.open(image_path) as image:
                assert image.size == (camera['width'], camera['height'])
                image.verify()
            for key in ['detectorDetections', 'detections']:
                assert key in frame
                for box in frame[key]:
                    assert len(box['bbox']) == 4
                    assert all(0 <= value <= 1 for value in box['bbox'])
        cameras.append({'id': camera['id'], 'frames': len(frames),
                        'uniqueContentFrames': sum(f['uniqueContent'] for f in frames),
                        'duplicateOfPreviousFrames': sum(f['duplicateOfPrevious'] for f in frames),
                        'mediaSeconds': frames[-1]['t'], 'width': camera['width'], 'height': camera['height']})
    return {'file': name, 'captureRunId': data['captureRunId'], 'capturedAt': data['capturedAt'],
            'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'cameras': cameras}

if __name__ == '__main__':
    result = {'status': 'integrity-verified', 'accuracyValidated': False,
              'sourceCaptureTimeKnown': False,
              'samples': [verify(name) for name in ['observations.json', 'validation-observations.json']]}
    output = ROOT / 'evidence' / 'recovery-validation.json'
    output.parent.mkdir(exist_ok=True)
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(result, ensure_ascii=False))
