#!/usr/bin/env python3
"""
P5 i18n：把英文港名（name_en）合併進 public/geo/port_polygons.geojson。只新增屬性，幾何與其他欄位不動；可重跑。

來源：taipei-gis-analytics 的 ports_merged_latest.geojson（73 筆有 name_en）。上游英文名是農業部漁港與 TDX 港口
依縣市湊合併的，漁港幾乎都對錯港（例：將軍漁港 -> "Tainan"、小琉球漁港 -> "Baisha Port"），所以：
- 漁港（農業部+TDX）一律不採用，顯示時退回中文。
- 其餘只採用下方 CURATED 清單（以名稱對應；值已修正大小寫／加 Port／Wharf 等後綴，統一格式）。
  重名港（小港漁港、鼻頭漁港、龍門漁港）不在清單內，所以名稱對應不會有歧義。
- 清單內每個名稱都會檢查上游有該筆 name_en，否則報錯（確保有出處）。

用法：python3 scripts/preprocess/merge-port-name-en.py [上游 geojson 路徑]
"""
import json
import os
import sys

BASE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(BASE, "public/geo/port_polygons.geojson")
DEFAULT_UPSTREAM = os.path.join(BASE, "../taipei-gis-analytics/data/processed/transportation/ports/ports_merged_latest.geojson")

CURATED = {
    # 商港
    "高雄港": "Kaohsiung Port",
    "基隆港": "Keelung Port",
    "臺中港": "Taichung Port",
    "花蓮港": "Hualien Port",
    "蘇澳港": "Suao Port",
    "安平港": "Anping Port",
    "臺北港": "Taipei Port",
    "布袋港": "Budai Port",
    "澎湖港": "Penghu Port",
    "金門水頭港": "Kinmen Shuitou Harbor",
    "金門九宮港": "Kinmen Jiugong Harbor",
    "金門料羅港": "Kinmen Liaoluo Harbor",
    # 渡輪／觀光碼頭
    "高雄旗津輪渡站": "Cijin Ferry Station",
    "前鎮輪渡站": "Qianzhen Ferry Station",
    "大佳碼頭": "Dajia Wharf",
    "美堤碼頭": "Meiti Wharf",
    "錫口碼頭": "Xikou Wharf",
    "大稻埕碼頭": "Dadaocheng Wharf",
    "關渡碼頭": "Guandu Wharf",
    "華江碼頭": "Huajiang Wharf",
    "忠孝碼頭": "Zhongxiao Wharf",
    # 對岸港口
    "大麥嶼": "Damaiyu",
    "福州平潭": "Fuzhou Pingtan",
    "福州黃岐港": "Fuzhou Huangqi Port",
    "廈門五通": "Xiamen Wutong",
    "泉州石井": "Quanzhou Shijing",
}


def main():
    upstream_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_UPSTREAM
    up = {}
    for f in json.load(open(upstream_path, encoding="utf-8"))["features"]:
        p = f["properties"]
        if (p.get("name_en") or "").strip():
            up.setdefault(p["name"], p["name_en"].strip())
    bad = [n for n in CURATED if n not in up]
    if bad:
        raise SystemExit(f"上游沒有這些港的 name_en：{bad}")
    data = json.load(open(OUT, encoding="utf-8"))
    names = [f["properties"]["name"] for f in data["features"]]
    dup = {n for n in names if names.count(n) > 1} & set(CURATED)
    if dup:
        raise SystemExit(f"清單內有重名港：{dup}")
    added = 0
    for f in data["features"]:
        n = f["properties"]["name"]
        if n in CURATED:
            f["properties"]["name_en"] = CURATED[n]
            added += 1
    missing = [n for n in CURATED if n not in names]
    if missing:
        raise SystemExit(f"public 資料沒有這些港：{missing}")
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)  # 與原檔排版一致（2 格縮排、無結尾換行）
    print(f"name_en 已加到 {added}/{len(names)} 筆（其餘退回中文）")


if __name__ == "__main__":
    main()
