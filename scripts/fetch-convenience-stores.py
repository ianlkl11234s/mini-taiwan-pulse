#!/usr/bin/env python3
"""
fetch-convenience-stores.py — 用 Overpass API 抓取全台灣便利商店資料

輸出: public/convenience_stores.geojson
來源: OpenStreetMap (shop=convenience in Taiwan)

用法: python3 scripts/fetch-convenience-stores.py
"""

import json
import ssl
import sys
import time
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError

# macOS Python 常見 SSL 問題 workaround
try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()
    SSL_CTX.check_hostname = False
    SSL_CTX.verify_mode = ssl.CERT_NONE

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Overpass QL: 搜尋台灣所有 shop=convenience 的 node 和 way
QUERY = """
[out:json][timeout:180];
area["ISO3166-1"="TW"]->.tw;
(
  node["shop"="convenience"](area.tw);
  way["shop"="convenience"](area.tw);
);
out center tags;
"""

BRAND_ALIASES = {
    "7-Eleven": "7-Eleven",
    "7-eleven": "7-Eleven",
    "7-ELEVEN": "7-Eleven",
    "統一超商": "7-Eleven",
    "FamilyMart": "FamilyMart",
    "全家": "FamilyMart",
    "全家便利商店": "FamilyMart",
    "Hi-Life": "Hi-Life",
    "萊爾富": "Hi-Life",
    "OK": "OK Mart",
    "OK超商": "OK Mart",
    "OKmart": "OK Mart",
    "OK·mart": "OK Mart",
}

OUT_PATH = Path(__file__).resolve().parent.parent / "public" / "convenience_stores.geojson"


def fetch_overpass(query: str) -> dict:
    """送出 Overpass API 查詢"""
    data = f"data={query}".encode("utf-8")
    req = Request(OVERPASS_URL, data=data, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    req.add_header("User-Agent", "mini-taiwan-pulse/1.0")

    print(f"  Querying Overpass API... (timeout=180s)")
    start = time.time()

    try:
        with urlopen(req, timeout=200, context=SSL_CTX) as resp:
            result = json.loads(resp.read().decode("utf-8"))
    except HTTPError as e:
        print(f"  HTTP Error {e.code}: {e.reason}")
        if e.code == 429:
            print("  Rate limited. Waiting 30s and retrying...")
            time.sleep(30)
            with urlopen(req, timeout=200, context=SSL_CTX) as resp:
                result = json.loads(resp.read().decode("utf-8"))
        else:
            raise
    except URLError as e:
        print(f"  URL Error: {e.reason}")
        raise

    elapsed = time.time() - start
    print(f"  Got {len(result.get('elements', []))} elements in {elapsed:.1f}s")
    return result


def normalize_brand(tags: dict) -> str:
    """從 OSM tags 取得標準化品牌名"""
    brand = tags.get("brand", "") or tags.get("name", "")
    return BRAND_ALIASES.get(brand, brand)


def to_geojson(elements: list) -> dict:
    """轉換 Overpass 結果為 GeoJSON"""
    features = []
    skipped = 0

    for el in elements:
        # node 有 lat/lon，way 有 center
        if el["type"] == "node":
            lon, lat = el.get("lon"), el.get("lat")
        elif el["type"] == "way" and "center" in el:
            lon, lat = el["center"]["lon"], el["center"]["lat"]
        else:
            skipped += 1
            continue

        if lon is None or lat is None:
            skipped += 1
            continue

        tags = el.get("tags", {})
        brand = normalize_brand(tags)
        name = tags.get("name", brand or "convenience store")

        feature = {
            "type": "Feature",
            "properties": {
                "name": name,
                "brand": brand,
                "addr": tags.get("addr:full", tags.get("addr:street", "")),
            },
            "geometry": {
                "type": "Point",
                "coordinates": [round(lon, 6), round(lat, 6)],
            },
        }
        features.append(feature)

    if skipped:
        print(f"  Skipped {skipped} elements without coordinates")

    return {"type": "FeatureCollection", "features": features}


def print_stats(geojson: dict):
    """印出品牌分佈統計"""
    brands: dict[str, int] = {}
    for f in geojson["features"]:
        b = f["properties"]["brand"] or "(unknown)"
        brands[b] = brands.get(b, 0) + 1

    print(f"\n  Total features: {len(geojson['features'])}")
    print("  Brand distribution:")
    for brand, count in sorted(brands.items(), key=lambda x: -x[1]):
        print(f"    {brand}: {count}")


def main():
    print("=== Fetch Taiwan Convenience Stores (Overpass API) ===\n")

    result = fetch_overpass(QUERY)
    elements = result.get("elements", [])

    if not elements:
        print("  No elements returned! Check your query or network.")
        sys.exit(1)

    geojson = to_geojson(elements)
    print_stats(geojson)

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(geojson, f, ensure_ascii=False)

    size_kb = OUT_PATH.stat().st_size / 1024
    print(f"\n  Written to: {OUT_PATH}")
    print(f"  File size: {size_kb:.0f} KB")
    print("\nDone!")


if __name__ == "__main__":
    main()
