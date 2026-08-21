#!/usr/bin/env python3
"""從 prisonmuseum mjac.zip（收容動態歷史打包檔）產生 live.prison_population_daily 回填 SQL。

用法：
    python3 prison_backfill_build.py <mjac.zip> <out.sql>

解析邏輯與 data-collectors/collectors/correctional_daily_snapshot.py 完全一致
（_roc_date / _int / _pct 原樣複製），避免兩邊對不上。
只產生 SQL，不連 DB、不執行。
"""
import re, sys, zipfile
import xml.etree.ElementTree as ET
from datetime import date

def _int(v):
    try: return int(str(v).strip().replace(",", ""))
    except (TypeError, ValueError, AttributeError): return None

def _pct(v):
    if v is None: return None
    try: return float(str(v).strip().rstrip("%"))
    except ValueError: return None

def _roc_date(s):
    if not s: return None
    m = re.match(r"(\d{2,3})/(\d{1,2})/(\d{1,2})", s.strip())
    if not m: return None
    try: return date(int(m.group(1)) + 1911, int(m.group(2)), int(m.group(3)))
    except ValueError: return None

def lit(v):
    return "NULL" if v is None else str(v)

def main(zip_path, out_path):
    rows, bad = {}, []
    with zipfile.ZipFile(zip_path) as z:
        names = sorted(n for n in z.namelist() if n.lower().endswith(".xml"))
        for n in names:
            try:
                root = ET.fromstring(z.read(n).decode("utf-8-sig"))
            except ET.ParseError as e:
                bad.append((n, f"parse error: {e}")); continue
            t = root.find("Table")
            if t is None:
                bad.append((n, "no Table element")); continue
            g = lambda tag: (t.findtext(tag) or "").strip() or None
            d = _roc_date(g("日期"))
            if d is None:
                bad.append((n, f"bad date: {g('日期')!r}")); continue
            rows[d] = (
                _int(g("實際收容")), _int(g("男")), _int(g("女")),
                _int(g("核定容額")), _pct(g("超收率")),
                _int(g("入監人數")), _int(g("出監人數")),
            )

    ds = sorted(rows)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("-- live.prison_population_daily 歷史回填\n")
        f.write("-- 來源：https://prisonmuseum.moj.gov.tw/jqw_pub/mjac.zip（收容動態歷史打包檔）\n")
        f.write(f"-- 檔案數 {len(names)}／可解析 {len(rows)}／不可解析 {len(bad)}\n")
        f.write(f"-- 日期範圍 {ds[0]} ~ {ds[-1]}（跨度 {(ds[-1]-ds[0]).days + 1} 天，缺 {(ds[-1]-ds[0]).days + 1 - len(ds)} 天）\n")
        f.write("-- ON CONFLICT DO NOTHING：不覆蓋 collector 已寫入的既有 row\n")
        f.write("BEGIN;\n")
        f.write("INSERT INTO live.prison_population_daily\n")
        f.write("  (observed_date, total_inmates, male_inmates, female_inmates,\n")
        f.write("   approved_capacity, over_capacity_pct, new_in_count, new_out_count, collected_at)\n")
        f.write("VALUES\n")
        vals = []
        for d in ds:
            tot, m, w, cap, pct, nin, nout = rows[d]
            vals.append(f"  ('{d}', {lit(tot)}, {lit(m)}, {lit(w)}, {lit(cap)}, {lit(pct)}, {lit(nin)}, {lit(nout)}, '{d} 05:00:00+08')")
        f.write(",\n".join(vals))
        f.write("\nON CONFLICT (observed_date) DO NOTHING;\n")
        f.write("COMMIT;\n")

    print(f"files={len(names)} parsed={len(rows)} bad={len(bad)}")
    print(f"range={ds[0]}..{ds[-1]} span_days={(ds[-1]-ds[0]).days + 1} missing={(ds[-1]-ds[0]).days + 1 - len(ds)}")
    for n, why in bad[:20]:
        print(f"  BAD {n}: {why}")
    print("2026-05-15 row:", rows.get(date(2026,5,15)))
    print("out:", out_path)

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
