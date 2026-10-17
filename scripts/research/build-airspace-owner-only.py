#!/usr/bin/env python3
"""Pin one eAIP cycle and produce a marked local research geometry copy."""
import hashlib
import json
from collections import Counter
from pathlib import Path
from shapely.geometry import mapping, shape

ROOT = Path(__file__).resolve().parents[2]
ANALYTICS = ROOT.parents[3] / "taipei-gis-analytics/data"
RAW = ANALYTICS / "raw/aviation/eaip"
PROCESSED = ANALYTICS / "processed/aviation/airspace/taiwan_airspace_3d.geojson"
OUTPUT = ROOT.parent / "runtime/owner-only/aviation-airspace/airspace-airac-01-26-owner.geojson"
RAW_RECEIPTS = {
    "2.1": (214911, "63f2d90214c01e7f8d7133afc93d2622ecea65900f124812bd0f30650bd7e465"),
    "5.1": (119374, "21e1f477c35dccb94d766e519a8ac4b8dd8fdc7dcc3eb77a631eaf53db726b00"),
    "5.3": (77908, "490d0015e831d8c5118e1eab71dc6885e41bc934b3ebabf538cb00231682d492"),
    "5.5": (147153, "d8028577d972def43234f1adeb47c057050f315694e135701561836fb0711274"),
}
PROCESSED_RECEIPT = (272538, "93db71eff491407e1222a404fd2443fa21b09d1ce78c3e87bb085d0f5ab778fc")
FIELDS = ("layer", "code", "name_zh", "name_en", "floor_m", "ceiling_m", "floor_raw", "ceiling_raw", "airspace_class", "layer_index", "source", "warnings", "remarks")
EXPECTED_LAYERS = {"FIR": 3, "TMA": 6, "RCR": 29, "ULZ": 20, "CTR": 12, "SURFACE": 6, "CONTROL": 2, "DANGER": 2, "CIRCUIT": 1}

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def verify(path, receipt):
    if path.stat().st_size != receipt[0] or sha(path) != receipt[1]:
        raise RuntimeError(f"AIRSPACE_SOURCE_MISMATCH:{path.name}")

def main():
    for section, receipt in RAW_RECEIPTS.items():
        verify(RAW / f"AIRAC_01-26_ENR-{section}-zh-TW.html", receipt)
    verify(PROCESSED, PROCESSED_RECEIPT)
    data = json.loads(PROCESSED.read_text())
    features = data.get("features", [])
    if data.get("type") != "FeatureCollection" or len(features) != 81:
        raise RuntimeError("AIRSPACE_COUNT_MISMATCH")
    counts, codes, output, repairs = Counter(), set(), [], []
    for feature in features:
        props = feature.get("properties", {})
        if set(props) != set(FIELDS) or feature.get("type") != "Feature" or feature.get("geometry", {}).get("type") != "Polygon":
            raise RuntimeError("AIRSPACE_SCHEMA_MISMATCH")
        code, layer = props["code"], props["layer"]
        key = (code, props["layer_index"])
        if not isinstance(code, str) or not code or key in codes or layer not in EXPECTED_LAYERS:
            raise RuntimeError("AIRSPACE_ID_MISMATCH")
        codes.add(key)
        counts[layer] += 1
        geom = shape(feature["geometry"])
        if geom.is_empty:
            raise RuntimeError("AIRSPACE_EMPTY_GEOMETRY")
        repaired = False
        geometry = feature["geometry"]
        if not geom.is_valid:
            if code != "RCR7":
                raise RuntimeError(f"AIRSPACE_UNEXPECTED_INVALID_GEOMETRY:{code}")
            fixed = geom.buffer(0)
            if not fixed.is_valid or fixed.geom_type != "Polygon" or abs(fixed.area - geom.area) > 1e-12:
                raise RuntimeError("AIRSPACE_REPAIR_MISMATCH")
            geometry = mapping(fixed)
            repaired = True
            repairs.append(code)
        safe = {name: props[name] for name in FIELDS}
        safe["geometry_repaired"] = repaired
        output.append({"type": "Feature", "properties": safe, "geometry": geometry})
    if dict(counts) != EXPECTED_LAYERS or repairs != ["RCR7"]:
        raise RuntimeError("AIRSPACE_DISTRIBUTION_MISMATCH")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps({"type": "FeatureCollection", "features": output}, ensure_ascii=False, separators=(",", ":")))
    print(json.dumps({"output": str(OUTPUT), "rows": len(output), "bytes": OUTPUT.stat().st_size, "sha256": sha(OUTPUT), "repairs": repairs, "layers": dict(counts)}, ensure_ascii=False))

if __name__ == "__main__":
    main()
