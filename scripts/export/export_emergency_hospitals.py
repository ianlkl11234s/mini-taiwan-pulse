#!/usr/bin/env python3
"""急救責任醫院 → public/geo/emergency_hospitals.geojson

來源：Supabase safety.emergency_hospitals（analytics docs/data-catalog/emergency_response/hospitals.md）。
先用唯讀 SELECT 匯出 CSV（只取下列欄位，不含 note／has_* 旗標）：

  \\copy (select h.hospital_id,h.name,h.county_id,c.name_zh as county,h.level,h.address,h.phone,
                 h.lat::float8 lat,h.lng::float8 lng
          from safety.emergency_hospitals h
          left join reference.counties c on c.id_moi=h.county_id
          order by h.hospital_id) to 'raw.csv' with (format csv, header)

再執行：python3 scripts/export/export_emergency_hospitals.py raw.csv public/geo/emergency_hospitals.geojson

level 空值 → level_group="unrated"（未標分級，不是「一般級」）。
"""
import csv
import json
import sys

GROUPS = {"重度級": "heavy", "中度級": "moderate", "一般級": "general"}


def main(src: str, dst: str) -> None:
    feats = []
    with open(src, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            lat, lng = float(r["lat"]), float(r["lng"])
            if not (21.5 < lat < 26.5 and 118 < lng < 123):
                raise SystemExit(f"座標超出台灣範圍：{r['hospital_id']} {lat},{lng}")
            level = (r.get("level") or "").strip()
            if level and level not in GROUPS:
                raise SystemExit(f"未知分級：{level}")
            props = {
                "hospital_id": r["hospital_id"],
                "name": r["name"],
                "county": r["county"] or "",
                "level_group": GROUPS.get(level, "unrated"),
                "address": r["address"] or "",
                "phone": r["phone"] or "",
                # 中央 SourceFooter 讀的來源欄（popup 否則顯示「來源資訊待補」）
                "source_org": "衛生福利部名冊、各縣市政府開放資料",
                "source_url": "https://dep.mohw.gov.tw/",
                "license": "政府資料開放授權條款（OGDL-Taiwan-1.0）",
                "fetched_at": "2026-05-16",
            }
            if level:
                props["level"] = level
            feats.append({"type": "Feature", "properties": props,
                          "geometry": {"type": "Point", "coordinates": [round(lng, 6), round(lat, 6)]}})
    with open(dst, "w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "features": feats}, f, ensure_ascii=False, separators=(",", ":"))
    print(len(feats), "features")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
