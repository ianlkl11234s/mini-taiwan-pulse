"""Audit post-NMS detector vs tracker outputs, without calling either ground truth."""
import argparse
import json
from pathlib import Path


def iou(a, b):
    x=max(0,min(a[2],b[2])-max(a[0],b[0])); y=max(0,min(a[3],b[3])-max(a[1],b[1]))
    intersection=x*y
    union=(a[2]-a[0])*(a[3]-a[1])+(b[2]-b[0])*(b[3]-b[1])-intersection
    return intersection/union if union>0 else 0


def compare(frame, threshold=.5):
    if not isinstance(frame.get('detectorDetections'),list):return None
    detector=frame['detectorDetections']; tracked=frame.get('detections',[])
    pairs=sorted(((iou(d['bbox'],t['bbox']),i,j) for i,d in enumerate(detector) for j,t in enumerate(tracked)),reverse=True)
    used_d,used_t=set(),set(); matches=[]
    for overlap,i,j in pairs:
        if overlap<threshold:break
        if i in used_d or j in used_t:continue
        used_d.add(i);used_t.add(j)
        matches.append({'detectorIndex':i,'trackIndex':j,'iou':round(overlap,4),'classMismatch':detector[i]['className']!=tracked[j]['className']})
    return {'t':frame['t'],'imageUrl':frame.get('imageUrl'),'detectorCount':len(detector),'trackCount':len(tracked),
            'matches':matches,'detectorOnly':[d for i,d in enumerate(detector) if i not in used_d],
            'trackOnly':[d for i,d in enumerate(tracked) if i not in used_t]}


def audit(data):
    cameras=[]
    for camera in data.get('cameras',[]):
        frames=camera.get('frames',[]); comparisons=[compare(f) for f in frames if f.get('duplicateOfPrevious') is not True and f.get('uniqueContent') is not False]
        rows=[r for r in comparisons if r is not None]
        summary=None if not rows else {'comparedDistinctFrames':len(rows),'detectorBoxes':sum(r['detectorCount'] for r in rows),
            'trackedBoxes':sum(r['trackCount'] for r in rows),'matchedBoxes':sum(len(r['matches']) for r in rows),
            'detectorOnlyBoxes':sum(len(r['detectorOnly']) for r in rows),'trackOnlyBoxes':sum(len(r['trackOnly']) for r in rows),
            'classDisagreements':sum(m['classMismatch'] for r in rows for m in r['matches'])}
        candidates=sorted((r for r in rows if r['detectorOnly'] or r['trackOnly']),key=lambda r:(-len(r['detectorOnly']),r['t']))[:20]
        cameras.append({'id':camera['id'],'summary':summary,'unknownStageFrames':sum(r is None for r in comparisons),'reviewCandidates':candidates})
    return {'captureId':data.get('capturedAt'),'basis':'same-frame independent post-NMS detector and tracker outputs; distinct content only',
        'matching':'greedy one-to-one IoU>=0.5 regardless of class; class disagreements separately reported',
        'notGroundTruth':True,'limitations':['Box totals are repeated frame observations, not distinct vehicles.','Detector-only does not establish a true missed vehicle.','Independent inference and tracker stages may differ; candidate matches require visual review.'], 'cameras':cameras}


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('input',type=Path);p.add_argument('output',type=Path);a=p.parse_args()
    result=audit(json.loads(a.input.read_text()));a.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps([{'id':c['id'],'summary':c['summary']} for c in result['cameras']]))
