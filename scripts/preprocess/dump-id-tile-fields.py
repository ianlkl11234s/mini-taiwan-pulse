#!/usr/bin/env python3
"""重產 src/data/__tests__/__fixtures__/id-tile-fields.json：印尼向量 PMTiles 的 tile layer 名、縮放、欄位清單與少量分類值（tilestats，distinct ≤60）。
用法：python3 scripts/preprocess/dump-id-tile-fields.py（需要 pmtiles CLI，檔在 public/world/id_*.pmtiles）。測試 idTileFields.test.ts 用它檢查規格用到的欄名與分類值確實存在。"""
import glob, json, os, subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
out = {}
for f in sorted(glob.glob(os.path.join(ROOT, "public/world/id_*.pmtiles"))):
    n = os.path.basename(f)
    if "terrain" in n or "inarisk" in n:
        continue  # raster，沒有屬性
    m = json.loads(subprocess.run(["pmtiles", "show", f, "--metadata"], capture_output=True, text=True, check=True).stdout)
    ts = {l["layer"]: {a["attribute"]: a for a in l.get("attributes", [])} for l in m.get("tilestats", {}).get("layers", [])}
    d = {}
    for l in m["vector_layers"]:
        vals = {}
        for k, a in ts.get(l["id"], {}).items():
            if a.get("type") in ("string", "number") and a.get("count", 999) <= 60 and a.get("values") is not None:
                vals[k] = sorted(a["values"], key=str)
        d[l["id"]] = {"minzoom": l.get("minzoom"), "maxzoom": l.get("maxzoom"), "fields": sorted(l["fields"]), "values": vals}
    out[n] = d
p = os.path.join(ROOT, "src/data/__tests__/__fixtures__/id-tile-fields.json")
with open(p, "w") as fh:
    json.dump(out, fh, ensure_ascii=False, indent=1, sort_keys=True)
print(len(out), "files ->", p)
