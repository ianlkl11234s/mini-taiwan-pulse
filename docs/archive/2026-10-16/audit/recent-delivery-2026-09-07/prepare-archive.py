"""Read-only archive plan for this delivery. Never uploads or deletes files."""
from pathlib import Path
import hashlib, json

PULSE = Path('/private/tmp/mtp-infrastructure-20260907')
PULSE_MAIN = Path('/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/mini-taiwan-pulse')
ANALYTICS = Path('/private/tmp/transport-regional-production-20260906/taipei-gis-analytics')
OUT = Path(__file__).parent
selected = {}
missing = []

def add(path, root, project, role):
    if not path.is_file():
        missing.append(str(path)); return
    relative = str(path.relative_to(root))
    key = (project, relative)
    if key in selected: return
    with path.open('rb') as stream:
        digest = hashlib.file_digest(stream, 'sha256').hexdigest()
    selected[key] = {'project':project, 'role':role, 'path':relative,
        'local_path':str(path), 'bytes':path.stat().st_size, 'sha256':digest,
        'proposed_key':f'archives/{project}/sha256/{digest}/{path.name}'}

# Prefer the integrated version, then fill ignored local-only data from the main checkout.
for root in [PULSE, PULSE_MAIN]:
    for path in sorted((root/'public/world').glob('jp_*')):
        if path.suffix in {'.pmtiles','.geojson','.json'}: add(path,root,'mini-taiwan-pulse','frontend-japan')
    for path in sorted((root/'public/statistics').rglob('*')):
        if path.is_file(): add(path,root,'mini-taiwan-pulse','statistics-geometry')

# Select existing regional-statistics manifests, not every transportation dataset.
for manifest in sorted((ANALYTICS/'data/processed').glob('*/*/_manifest.json')):
    doc=json.loads(manifest.read_text())
    if 'release_id' not in doc.get('schema',{}).get('primary_key',[]): continue
    folder=manifest.parent
    add(manifest,ANALYTICS,'taipei-gis-analytics','statistics-manifest')
    for path in sorted(folder.rglob('*')):
        if path.is_file(): add(path,ANALYTICS,'taipei-gis-analytics','statistics-processed')
    raw=ANALYTICS/'data/raw'/folder.relative_to(ANALYTICS/'data/processed')
    # Source adapter keeps its historical raw-folder name; processed label was corrected.
    if folder.name == 'taichung_road_noise_monitoring_stations':
        raw=ANALYTICS/'data/raw/environment/taichung_road_noise_noncompliant_stations'
    if not raw.exists(): missing.append(str(raw))
    else:
        for path in sorted(raw.rglob('*')):
            if path.is_file(): add(path,ANALYTICS,'taipei-gis-analytics','statistics-raw')
# Upstream Japanese source/processed snapshots are needed for reproducibility.
upstream_main=PULSE_MAIN.parent/'taipei-gis-analytics'
for stage in ['raw','processed']:
    for folder in sorted((upstream_main/'data'/stage/'world').glob('jp_*')):
        for path in sorted(folder.rglob('*')):
            if path.is_file(): add(path,upstream_main,'taipei-gis-analytics','japan-'+stage)
files=list(selected.values())
report={'status':'PLAN_ONLY_NOT_UPLOADED','destination_bucket':None,
    'visibility':'private archive required; never deploy-assets',
    'scope':'Available Japanese frontend/raw/processed files and regional-statistics manifests/releases/raw from listed roots. Not a full database backup; unresolved source paths remain explicit.',
    'file_count':len(files),'bytes':sum(x['bytes'] for x in files),
    'unresolved_paths':missing,'files':files}
output=OUT/'archive-plan.json';output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k!='files'},ensure_ascii=False))
print('manifest_sha256',hashlib.sha256(output.read_bytes()).hexdigest())
