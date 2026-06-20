#!/usr/bin/env python3
"""
Audit SSOT facility locations against Google Maps Places.

READ-ONLY. Writes markdown report to docs/audit/.
Caches Google responses to scripts/audit/.places_cache.json.
"""
from __future__ import annotations

import json
import math
import os
import sys
import time
from pathlib import Path

import psycopg2
import psycopg2.extras
import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
CACHE_PATH = ROOT / "scripts" / "audit" / ".places_cache.json"
REPORT_PATH = ROOT / "docs" / "audit" / "2026-06-20_facility_location_audit_v2.md"

load_dotenv(ROOT / ".env")

DB_URL = os.environ["SUPABASE_DB_URL"]
GMAPS_KEY = os.environ["GOOGLE_MAPS_API_KEY"]

PASS_THRESHOLD_M = 200
CRITICAL_THRESHOLD_M = 1000


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371000.0
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def shares_2char(a: str, b: str) -> bool:
    """Return True if a and b share any 2-char substring."""
    if not a or not b:
        return False
    bigrams_a = {a[i : i + 2] for i in range(len(a) - 1)}
    bigrams_b = {b[i : i + 2] for i in range(len(b) - 1)}
    return bool(bigrams_a & bigrams_b)


def fetch_facilities() -> list[dict]:
    sql = """
        SELECT facility_id, name, name_zh, fuel_type, county, lat, lng
          FROM energy.facilities_overview_v
         WHERE source_priority <= 4
           AND lat IS NOT NULL AND lng IS NOT NULL
         ORDER BY facility_id
    """
    with psycopg2.connect(DB_URL) as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql)
            return [dict(r) for r in cur.fetchall()]


def load_cache() -> dict:
    if CACHE_PATH.exists():
        return json.loads(CACHE_PATH.read_text())
    return {}


def save_cache(cache: dict) -> None:
    CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False, indent=2))


PLACES_URL = "https://places.googleapis.com/v1/places:searchText"


def search_place(_unused, query: str) -> dict | None:
    """Google Places API (New) searchText."""
    resp = requests.post(
        PLACES_URL,
        headers={
            "Content-Type": "application/json",
            "X-Goog-Api-Key": GMAPS_KEY,
            "X-Goog-FieldMask": "places.displayName,places.location,places.formattedAddress,places.id",
        },
        json={"textQuery": query, "languageCode": "zh-TW", "regionCode": "TW"},
        timeout=15,
    )
    if resp.status_code != 200:
        # Treat as no result if quota / 4xx — but raise to surface unexpected errors
        raise RuntimeError(f"Places(New) HTTP {resp.status_code}: {resp.text[:300]}")
    data = resp.json()
    places = data.get("places") or []
    if not places:
        return None
    r = places[0]
    loc = r.get("location") or {}
    return {
        "name": (r.get("displayName") or {}).get("text"),
        "place_id": r.get("id"),
        "lat": loc.get("latitude"),
        "lng": loc.get("longitude"),
        "formatted_address": r.get("formattedAddress"),
        "query": query,
    }


def main():
    print(f"[*] Loading facilities from {DB_URL.split('@')[-1]}", file=sys.stderr)
    facilities = fetch_facilities()
    print(f"[*] {len(facilities)} facilities (source_priority<=4)", file=sys.stderr)

    cache = load_cache()
    gmaps = None  # using direct REST

    audited = []
    errors = []
    api_calls = 0

    for i, f in enumerate(facilities):
        fid = f["facility_id"]
        ssot_name = f.get("name_zh") or f["name"]
        county = f.get("county") or ""
        ssot_lat = float(f["lat"])
        ssot_lng = float(f["lng"])

        cached = cache.get(fid)
        if cached:
            best = cached.get("best")
            low_conf = cached.get("low_conf", False)
            attempts = cached.get("attempts", 0)
        else:
            attempts = 0
            best = search_place(gmaps, ssot_name)
            attempts += 1
            api_calls += 1
            time.sleep(0.05)

            low_conf = False
            if best is None or not shares_2char(ssot_name, best.get("name") or ""):
                # retry with county
                if county:
                    q2 = f"{ssot_name} {county}"
                    best2 = search_place(gmaps, q2)
                    attempts += 1
                    api_calls += 1
                    time.sleep(0.05)
                    if best2 is not None:
                        if best is None or shares_2char(ssot_name, best2.get("name") or ""):
                            best = best2
                low_conf = not (best and shares_2char(ssot_name, best.get("name") or ""))

            cache[fid] = {"best": best, "low_conf": low_conf, "attempts": attempts}
            if (i + 1) % 25 == 0:
                save_cache(cache)
                print(f"[*] {i+1}/{len(facilities)}  api_calls={api_calls}", file=sys.stderr)

        if best is None:
            errors.append({"facility_id": fid, "name": ssot_name, "county": county, "reason": "no_results"})
            continue

        try:
            diff_m = haversine_m(ssot_lat, ssot_lng, float(best["lat"]), float(best["lng"]))
        except Exception as e:
            errors.append({"facility_id": fid, "name": ssot_name, "reason": f"calc_error: {e}"})
            continue

        audited.append(
            {
                "facility_id": fid,
                "ssot_name": ssot_name,
                "ssot_lat": ssot_lat,
                "ssot_lng": ssot_lng,
                "google_name": best.get("name"),
                "google_lat": best.get("lat"),
                "google_lng": best.get("lng"),
                "place_id": best.get("place_id"),
                "diff_m": diff_m,
                "low_conf": low_conf,
                "fuel_type": f.get("fuel_type"),
                "county": county,
            }
        )

    save_cache(cache)

    # Categorize
    critical = [a for a in audited if a["diff_m"] > CRITICAL_THRESHOLD_M]
    review = [a for a in audited if PASS_THRESHOLD_M <= a["diff_m"] <= CRITICAL_THRESHOLD_M]
    passed = [a for a in audited if a["diff_m"] < PASS_THRESHOLD_M]

    critical.sort(key=lambda x: -x["diff_m"])
    review.sort(key=lambda x: -x["diff_m"])

    # Total API calls (current run + previously cached) for honest cost reporting
    total_attempts = sum(v.get("attempts", 0) for v in cache.values())
    cost_usd_places = total_attempts * 32 / 1000.0  # Places Text Search rate

    # Write markdown
    lines = []
    lines.append("# Facility Location Audit — 2026-06-20")
    lines.append("")
    lines.append(f"- 總廠數（source_priority ≤ 4）：**{len(facilities)}**")
    lines.append(f"- 已比對：**{len(audited)}**  / 無 Google 結果：**{len(errors)}**")
    lines.append(f"- ✓ Pass (<{PASS_THRESHOLD_M}m)：**{len(passed)}**")
    lines.append(f"- ⚠ Review ({PASS_THRESHOLD_M}–{CRITICAL_THRESHOLD_M}m)：**{len(review)}**")
    lines.append(f"- ❌ Critical (>{CRITICAL_THRESHOLD_M}m)：**{len(critical)}**")
    lines.append(
        f"- Google API calls：**{total_attempts}** (本次 {api_calls} + 快取 {total_attempts - api_calls})"
    )
    lines.append(
        f"- 預估成本：Places Text Search **${cost_usd_places:.2f}** (@$32/1000)"
    )
    lines.append("")
    lines.append("> ⚠️ = Google 回傳名稱與 SSOT 名稱無共通 2-char 子字串（低信心配對）")
    lines.append("")

    def row(a):
        gname = a["google_name"] or ""
        if a["low_conf"]:
            gname += " ⚠️"
        link = (
            f"https://www.google.com/maps/search/?api=1"
            f"&query={a['google_lat']},{a['google_lng']}"
            f"&query_place_id={a['place_id']}"
        )
        return (
            f"| {a['facility_id']} | {a['ssot_name']} | "
            f"({a['ssot_lat']:.5f},{a['ssot_lng']:.5f}) | {gname} | "
            f"({a['google_lat']:.5f},{a['google_lng']:.5f}) | "
            f"{a['diff_m']:.0f} | [map]({link}) |"
        )

    header = (
        "| facility_id | SSOT name | SSOT (lat,lng) | Google name | "
        "Google (lat,lng) | diff_m | Link |"
    )
    sep = "|---|---|---|---|---|---:|---|"

    lines.append(f"## ❌ Critical (diff > {CRITICAL_THRESHOLD_M}m) — {len(critical)} 廠")
    lines.append("")
    if critical:
        lines.append(header)
        lines.append(sep)
        lines.extend(row(a) for a in critical)
    else:
        lines.append("_(無)_")
    lines.append("")

    lines.append(f"## ⚠ Review ({PASS_THRESHOLD_M}–{CRITICAL_THRESHOLD_M}m) — {len(review)} 廠")
    lines.append("")
    if review:
        lines.append(header)
        lines.append(sep)
        lines.extend(row(a) for a in review)
    else:
        lines.append("_(無)_")
    lines.append("")

    lines.append(f"## ✓ Pass (<{PASS_THRESHOLD_M}m) — {len(passed)} 廠 (略)")
    lines.append("")

    if errors:
        lines.append(f"## 🛑 無 Google 結果 — {len(errors)} 廠")
        lines.append("")
        lines.append("| facility_id | name | county | reason |")
        lines.append("|---|---|---|---|")
        for e in errors:
            lines.append(f"| {e['facility_id']} | {e['name']} | {e.get('county','')} | {e['reason']} |")
        lines.append("")

    REPORT_PATH.write_text("\n".join(lines), encoding="utf-8")

    # stderr summary
    print(f"\n[done] total={len(facilities)} pass={len(passed)} review={len(review)} critical={len(critical)} errors={len(errors)}", file=sys.stderr)
    print(f"[done] api_calls_this_run={api_calls} total_attempts={total_attempts} places_cost=${cost_usd_places:.2f}", file=sys.stderr)
    print(f"[done] report: {REPORT_PATH}", file=sys.stderr)

    # JSON summary on stdout for caller
    print(json.dumps({
        "total": len(facilities),
        "pass": len(passed),
        "review": len(review),
        "critical": len(critical),
        "errors": len(errors),
        "api_calls_this_run": api_calls,
        "total_api_attempts": total_attempts,
        "cost_usd_places": round(cost_usd_places, 2),
        "top5_worst": [
            {"facility_id": a["facility_id"], "name": a["ssot_name"], "diff_m": round(a["diff_m"])}
            for a in critical[:5]
        ],
        "no_result_facilities": [
            {"facility_id": e["facility_id"], "name": e["name"], "county": e.get("county","")}
            for e in errors[:20]
        ],
        "report_path": str(REPORT_PATH),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
