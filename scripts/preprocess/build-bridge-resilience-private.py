#!/usr/bin/env python3
"""把 analytics 的 bridge-display-bundle 打包成站主限定私人資產（不進 public/、不 commit）。

用法：python3 scripts/preprocess/build-bridge-resilience-private.py <bundle_dir> <out_dir>
- 先用 bundle 的 receipt.json 驗每個輸入檔的 SHA-256 與大小，任何不符即中止。
- bridges／replacement_routes／villages 三份 GeoJSON 打成一個 PMTiles（source-layer 同名）。
  villages 以 int(VILLCODE) 當 feature id，前端 feature-state 才能穩定對應（不依賴 promoteId）。
- bridge_summary.json、village_impacts.json 原檔複製（走 sidecar 同家族的私人 Range 路由）。
- 已知：上游 bridges.geojson 有 77 處裸 NaN（無名匝道的 name），非合法 JSON；這裡把 NaN 屬性移除，
  其餘幾何與欄位不變。上游 SHA 仍以原檔驗證。
- 輸出 local_validation.json（三個資產的 size／sha256），供 sidecar 契約與上傳腳本核對。
需要 tippecanoe（brew install tippecanoe）。
"""
import hashlib, json, math, shutil, subprocess, sys
from pathlib import Path

PMTILES = "bridge-resilience-20260930-v1.pmtiles"
JSONS = ("bridge_summary.json", "village_impacts.json")


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def load_lenient(path: Path):
    """讀 GeoJSON；NaN 轉 None（json 預設就接受 NaN 字面值，回傳 float nan）。"""
    def fix(x):
        if isinstance(x, float) and math.isnan(x):
            return None
        return x
    data = json.loads(path.read_text(encoding="utf-8"))
    for f in data["features"]:
        f["properties"] = {k: fix(v) for k, v in f["properties"].items() if fix(v) is not None}
    return data


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    bundle, out = Path(sys.argv[1]), Path(sys.argv[2])
    receipt = json.loads((bundle / "receipt.json").read_text(encoding="utf-8"))
    for name, meta in receipt["outputs"].items():
        p = bundle / name
        if not p.exists():
            continue  # README.md 可能只在 analytics 工作樹追蹤
        if p.stat().st_size != meta["size_bytes"] or sha256(p) != meta["sha256"]:
            sys.exit(f"bundle 檔案與 receipt 不符：{name}")
    out.mkdir(parents=True, exist_ok=True)
    tmp = out / "_build"
    tmp.mkdir(exist_ok=True)
    layers = []
    for layer in ("bridges", "replacement_routes", "villages"):
        src = bundle / f"{layer}.geojson"
        data = load_lenient(src)
        if layer == "villages":
            for f in data["features"]:
                f["id"] = int(f["properties"]["VILLCODE"])
        dst = tmp / f"{layer}.geojson"
        dst.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        layers += ["-L", f"{layer}:{dst}"]
    target = out / PMTILES
    target.unlink(missing_ok=True)
    subprocess.run(["tippecanoe", "-o", str(target), "-Z8", "-z14", "--no-feature-limit", "--no-tile-size-limit",
                    "--detect-shared-borders", "-n", "bridge-resilience", "-q", *layers], check=True)
    shutil.rmtree(tmp)
    for name in JSONS:
        shutil.copyfile(bundle / name, out / name)
    validation = {
        "source_bundle": receipt["dataset_id"],
        "publication_status": receipt["publication_status"],
        "assets": {n: {"size": (out / n).stat().st_size, "sha256": sha256(out / n)} for n in (PMTILES, *JSONS)},
    }
    (out / "local_validation.json").write_text(json.dumps(validation, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(validation, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
