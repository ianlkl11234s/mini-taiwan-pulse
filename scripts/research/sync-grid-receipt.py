#!/usr/bin/env python3
"""Pin only a fully reverified local grid bundle; never publish or copy its bytes."""
import argparse
import hashlib
import importlib
import json
from pathlib import Path
import sys

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--analytics', type=Path, required=True)
parser.add_argument('--check', action='store_true')
args = parser.parse_args()
root = args.analytics.resolve()
sys.path.insert(0, str(root))
verify = importlib.import_module('src.analysis.library.schools_grid').verify_bundle
bundle_path = root / 'data/intermediate/research-library/schools-grid-v3/bundle.json'
raw = bundle_path.read_bytes()
bundle = json.loads(raw)
proof = verify(bundle, bundle_path.parent)
if not proof['valid']:
    raise SystemExit(f'GRID_READBACK_FAILED: {proof["errors"]}')
receipt = {
    'datasetId': bundle['datasetId'], 'assetId': bundle['asset']['id'],
    'bundleSha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw),
    'methodVersion': bundle['gridDefinition']['version'], 'readback': proof,
    'scope': 'local research only; unknown source license/freshness; not production',
}
target = Path(__file__).resolve().parents[2] / 'src/research/contracts/schools-grid-receipt.json'
encoded = json.dumps(receipt, ensure_ascii=False, indent=2) + '\n'
if args.check:
    if target.read_text() != encoded:
        raise SystemExit('GRID_RECEIPT_DRIFT')
else:
    target.write_text(encoded)
print(json.dumps(receipt, ensure_ascii=False))
