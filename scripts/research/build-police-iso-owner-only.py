#!/usr/bin/env python3
"""Copy three pinned historical police coverage model outputs for local owner queries."""
import hashlib
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT.parents[3] / "taipei-gis-analytics/data/processed/police_justice/isochrone"
OUTPUT = ROOT.parent / "runtime/owner-only/police-iso"
FAMILIES = {
    "substation": (18_440_196, "d135d84ce395b9762d0ba83d1118e88d54c8e142af75015e7a59bd10fdea3adc", 112),
    "precinct": (1_625_842, "0ad87d5c066ad70191bd24a7aa08fb9b99c48e6a377f626b3605eece937d31a4", 64),
    "police_dept": (227_369, "833780de88055fc0c0772d360738f04cd3784b8fe2ded5aa54ab607e5e03406c", 37),
}

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    result = {}
    for tier, (size, digest, rows) in FAMILIES.items():
        name = f"police_iso_{tier}_combined.geojson"
        src = SOURCE / name
        if src.stat().st_size != size or sha(src) != digest:
            raise RuntimeError(f"POLICE_ISO_SOURCE_MISMATCH:{name}")
        data = json.loads(src.read_text())
        features = data.get("features", [])
        if data.get("type") != "FeatureCollection" or len(features) != rows:
            raise RuntimeError(f"POLICE_ISO_COUNT_MISMATCH:{name}")
        if any(f.get("properties", {}).get("tier") != tier or f.get("geometry", {}).get("type") not in ("Polygon", "MultiPolygon") for f in features):
            raise RuntimeError(f"POLICE_ISO_SHAPE_MISMATCH:{name}")
        OUTPUT.mkdir(parents=True, exist_ok=True)
        target = OUTPUT / name
        shutil.copyfile(src, target)
        if sha(target) != digest:
            raise RuntimeError(f"POLICE_ISO_COPY_MISMATCH:{name}")
        result[tier] = {"rows": rows, "bytes": size, "sha256": digest}
    print(json.dumps(result, ensure_ascii=False))

if __name__ == "__main__":
    main()
