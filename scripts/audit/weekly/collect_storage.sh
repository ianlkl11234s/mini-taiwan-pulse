#!/bin/bash
# scripts/audit/weekly/collect_storage.sh
# 週巡檢 B4（S3 用量與費用估算）+ B5（R2 用量與費用估算）之儲存收集器。
# B6（CDN cache 有效性）不在本支範圍——見 docs/proposal/weekly-audit-2026-08-21/README.md §7 落地步驟，
# 本輪只補 B4/B5。
#
# 硬約束：絕不 echo 任何密鑰／完整 endpoint URL；純讀（ls／size），禁止 cp／rm／sync／mb／rb；
#         單一步驟失敗記進 errors 並讓 ok:=false（或 report_error_soft 若屬「查不到但非本輪失敗」），
#         不中斷其他步驟。
#
# 輸出：.claude/.cache/weekly-audit/storage.json（契約見 docs/proposal/weekly-audit-2026-08-21/README.md）

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib.sh
source "$SCRIPT_DIR/lib.sh"

load_env
init_report "storage"

# =====================================================================
# 牌價常數（單一頂部定義，2026-08 查得，過期需重新查證——不要在下方邏輯裡散落數字）
# =====================================================================
S3_RATE_USD_PER_GB_MONTH="0.025"   # AWS S3 Standard, ap-southeast-2（牌價，未含請求費/傳輸費）
R2_RATE_USD_PER_GB_MONTH="0.015"   # Cloudflare R2 儲存（egress 免費，是 R2 相對 S3 的主要優勢）
S3_TOTAL_YELLOW_THRESHOLD_GB="50"  # 超過此量體 B4 初判 yellow，否則 green

# R2 bucket 名並非猜測：來源 taipei-gis-analytics
# docs/handoff/read-path-cdn-imagery.md（「Bucket │ mini-tw-pulse（Cloudflare R2，APAC）」）。
# rclone remote 名 r2: 已在本機 rclone.conf 設好憑證（非本腳本的 .env），本腳本只讀不寫。
R2_KNOWN_BUCKET="mini-tw-pulse"

export S3_RATE_USD_PER_GB_MONTH R2_RATE_USD_PER_GB_MONTH

# =====================================================================
# B4 — S3 deploy-assets/ 用量、前綴分佈、費用估算、重複物件偵測
# =====================================================================
CURRENT_STEP="B4_s3"

if [ -z "${S3_ACCESS_KEY:-}" ] || [ -z "${S3_SECRET_KEY:-}" ] || [ -z "${S3_BUCKET:-}" ] || [ -z "${S3_REGION:-}" ]; then
  report_error "S3 憑證未齊（S3_ACCESS_KEY/S3_SECRET_KEY/S3_BUCKET/S3_REGION 其一缺失於 .env），略過 B4"
else
  S3_PY_RESULT="$(python3 <<'PYEOF'
import os, re, json, signal, time
from collections import defaultdict, Counter

result = {"ok": True, "metrics": {}, "findings": [], "errors": []}

def err(step, exc):
    result["ok"] = False
    result["errors"].append({"step": step, "message": str(exc)[:300]})

try:
    import boto3
except Exception as e:
    err("B4_boto3_import", e)
    print(json.dumps(result, ensure_ascii=False))
    raise SystemExit(0)

BUCKET = os.environ["S3_BUCKET"]
RATE = float(os.environ["S3_RATE_USD_PER_GB_MONTH"])
YELLOW_GB = 50.0
PREFIX = "deploy-assets/"

class ListingTimeout(Exception):
    pass

def _alarm_handler(signum, frame):
    raise ListingTimeout("S3 listing 超過時間預算")

def list_prefix(client, prefix, budget_sec):
    """列出單一 prefix 底下全部物件，budget_sec 秒內未完成則丟 ListingTimeout。"""
    objs = []
    old_handler = signal.signal(signal.SIGALRM, _alarm_handler)
    signal.alarm(budget_sec)
    try:
        paginator = client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=BUCKET, Prefix=prefix):
            for o in page.get("Contents", []):
                objs.append({"key": o["Key"], "size": int(o["Size"])})
    finally:
        signal.alarm(0)
        signal.signal(signal.SIGALRM, old_handler)
    return objs

client = None
try:
    client = boto3.client(
        "s3",
        aws_access_key_id=os.environ["S3_ACCESS_KEY"],
        aws_secret_access_key=os.environ["S3_SECRET_KEY"],
        region_name=os.environ["S3_REGION"],
    )
except Exception as e:
    err("B4_client_init", e)
    print(json.dumps(result, ensure_ascii=False))
    raise SystemExit(0)

objects = []
listing_mode = "single_call"
t0 = time.time()
try:
    objects = list_prefix(client, PREFIX, budget_sec=180)
except ListingTimeout:
    # 降級：改成逐子前綴分別列（各自獨立時間預算，單一子前綴逾時只跳過該前綴不中斷全體）
    listing_mode = "per_subprefix_fallback"
    objects = []
    try:
        top = client.list_objects_v2(Bucket=BUCKET, Prefix=PREFIX, Delimiter="/")
        subprefixes = [p["Prefix"] for p in top.get("CommonPrefixes", [])]
        for o in top.get("Contents", []):
            objects.append({"key": o["Key"], "size": int(o["Size"])})
        for sp in subprefixes:
            try:
                objects.extend(list_prefix(client, sp, budget_sec=60))
            except ListingTimeout:
                result["errors"].append({
                    "step": "B4_subprefix_timeout",
                    "message": f"子前綴 {sp} 逾時（60s），該前綴此輪缺漏",
                })
                result["ok"] = False
    except Exception as e:
        err("B4_fallback_listing", e)
except Exception as e:
    err("B4_listing", e)

listing_duration = round(time.time() - t0, 1)

if objects:
    total_bytes = sum(o["size"] for o in objects)
    total_objects = len(objects)

    # 依 deploy-assets/ 之後第一段路徑分組；root 底下沒有子目錄的檔案歸類 "(root)"
    prefixes = defaultdict(lambda: {"objects": 0, "bytes": 0})
    for o in objects:
        rest = o["key"][len(PREFIX):]
        seg = rest.split("/", 1)[0] if "/" in rest else "(root)"
        prefixes[seg]["objects"] += 1
        prefixes[seg]["bytes"] += o["size"]

    result["metrics"]["s3_total_bytes"] = total_bytes
    result["metrics"]["s3_total_objects"] = total_objects
    result["metrics"]["s3_listing_mode"] = listing_mode
    result["metrics"]["s3_listing_duration_sec"] = listing_duration
    result["metrics"]["s3_prefixes"] = {k: v for k, v in sorted(prefixes.items(), key=lambda kv: -kv[1]["bytes"])}

    total_gb = total_bytes / (1024 ** 3)
    monthly_cost = round(total_gb * RATE, 4)
    result["metrics"]["s3_monthly_cost_usd_estimate"] = monthly_cost

    top5 = sorted(prefixes.items(), key=lambda kv: -kv[1]["bytes"])[:5]
    top5_str = "; ".join(f'{k}: {v["objects"]}物件/{v["bytes"]/1024/1024:.1f}MB' for k, v in top5)

    level = "yellow" if total_gb > YELLOW_GB else "green"
    result["findings"].append({
        "id": "B4",
        "level": level,
        "title": f"S3 deploy-assets/ 共 {total_objects} 物件、{total_gb:.2f} GB，估算月費 US${monthly_cost}",
        "detail": (
            f"牌價估算，未含請求費與傳輸費，非實際帳單。費率 US${RATE}/GB/月"
            "（ap-southeast-2 S3 Standard，2026-08 查得，過期需重新查證）。"
            f"列表模式：{listing_mode}，耗時 {listing_duration}s。"
            f"初判閾值：總量 > {YELLOW_GB}GB → yellow，否則 green（本次{'超過' if total_gb > YELLOW_GB else '未超過'}）。"
        ),
        "evidence": f"前 5 大子前綴 — {top5_str}",
    })

    # ---- 加分項：同名同大小物件出現在不同路徑（root vs 分類子目錄的遺留重複）----
    groups = defaultdict(list)
    for o in objects:
        bn = o["key"].rsplit("/", 1)[-1]
        if bn == "_manifest.json":
            continue  # 每個資料集各自一份、內容不同，非重複
        groups[(bn, o["size"])].append(o["key"])
    dup_groups = {k: v for k, v in groups.items() if len(v) > 1}
    wasted_bytes = sum(size * (len(keys) - 1) for (bn, size), keys in dup_groups.items())

    if dup_groups:
        sample = sorted(dup_groups.items(), key=lambda kv: -kv[0][1])[:10]
        sample_str = "; ".join(f'{bn}({size/1024/1024:.1f}MB): {", ".join(keys)}' for (bn, size), keys in sample)
        result["findings"].append({
            "id": "B4",
            "level": "yellow",
            "title": f"{len(dup_groups)} 組同名同大小物件同時存在 deploy-assets/ 根目錄與分類子目錄（估計可省 {wasted_bytes/1024/1024:.1f} MB）",
            "detail": (
                "口徑：basename + 完全相同 byte size 出現在不同路徑，排除 _manifest.json（各資料集內容本就不同）。"
                "疑似扁平結構遷移到分類子目錄（agriculture/geo/forestry/education 等）後，"
                "根目錄舊檔未清理；需人工確認是否仍有 manifest 指向根目錄路徑，確認無引用才可清。"
            ),
            "evidence": f"前 10 大（依單檔大小）— {sample_str}",
        })
    else:
        result["findings"].append({
            "id": "B4", "level": "green",
            "title": "deploy-assets/ 未偵測到同名同大小的跨路徑重複物件",
            "detail": "", "evidence": "",
        })

    # ---- 加分項：dated 檔案堆積觀察（climate/frames/ 時序影格，非重複但無明顯 retention）----
    climate_frames = [o for o in objects if o["key"].startswith(f"{PREFIX}climate/frames/")]
    if climate_frames:
        cf_bytes = sum(o["size"] for o in climate_frames)
        ts_list = sorted(set(
            m.group(1) for o in climate_frames
            if (m := re.search(r"(\d{8}T\d{4,6})Z", o["key"]))
        ))
        date_range = f"{ts_list[0]} ~ {ts_list[-1]}" if ts_list else "未知"
        result["findings"].append({
            "id": "B4",
            "level": "yellow",
            "title": f"climate/frames/ 累積 {len(climate_frames)} 個帶時間戳影格、共 {cf_bytes/1024/1024:.1f} MB，未見明顯 retention 政策",
            "detail": (
                "非重複物件（各時間點內容不同），但持續累積且時間跨度含未來預報時點，"
                "建議確認是否該搭配 lifecycle rule 或上游 collector 保留天數清理舊影格。"
            ),
            "evidence": f"時間戳範圍：{date_range}；子目錄：{sorted(set(o['key'][len(PREFIX)+len('climate/frames/'):].split('/')[0] for o in climate_frames))}",
        })

    # ---- top10 largest objects（全 deploy-assets/ 範圍，供人工判斷該不該清）----
    top10 = sorted(objects, key=lambda o: -o["size"])[:10]
    result["metrics"]["s3_top10_largest_objects"] = [
        {"key": o["key"], "bytes": o["size"]} for o in top10
    ]
elif result["ok"]:
    err("B4_empty_or_failed", "S3 listing 回傳空集合且未拋例外，deploy-assets/ 可能不存在或憑證權限不足")

if client is not None:
    try:
        client.close()
    except Exception:
        pass

try:
    print(json.dumps(result, ensure_ascii=False))
except Exception as e:
    print(json.dumps({"ok": False, "metrics": {}, "findings": [],
                       "errors": [{"step": "B4_serialize", "message": str(e)[:300]}]}))
PYEOF
)"
  S3_PY_RC=$?

  if [ $S3_PY_RC -ne 0 ] || ! echo "$S3_PY_RESULT" | jq -e . >/dev/null 2>&1; then
    report_error "python3 B4 收集主體非正常結束（rc=${S3_PY_RC}），輸出不是合法 JSON，S3 用量本輪可能缺漏"
  else
    s3_py_ok=$(echo "$S3_PY_RESULT" | jq -r '.ok')
    [ "$s3_py_ok" = "false" ] && REPORT_OK=false
    metrics_merge "$(echo "$S3_PY_RESULT" | jq -c '.metrics // {}')"
    findings_merge "$(echo "$S3_PY_RESULT" | jq -c '.findings // []')"
    echo "$S3_PY_RESULT" | jq -c '.errors // [] | .[]' 2>/dev/null | while IFS= read -r e; do
      echo "$e" >> "$ERRORS_FILE"
    done
  fi
fi

# =====================================================================
# B5 — R2 用量與費用估算（rclone remote r2:，已知 token 無 ListObjectsV2 權限的已知限制）
# =====================================================================
CURRENT_STEP="B5_r2"

if ! command -v rclone >/dev/null 2>&1; then
  report_error_soft "rclone 未安裝，略過 B5"
else
  R2_START=$(timer_start)
  export R2_KNOWN_BUCKET
  # 用 python3 subprocess 設真正的逾時（macOS 預設無 gtimeout/timeout 指令）
  # 引號 heredoc（'PYEOF'）：不做 bash 變數代換，一律透過 os.environ 讀值，
  # 避免密鑰／endpoint 值裡的特殊字元被 bash 解讀或破壞 Python 語法。
  R2_PY_RESULT="$(python3 <<'PYEOF'
import json, os, subprocess

bucket = os.environ["R2_KNOWN_BUCKET"]
rate = float(os.environ["R2_RATE_USD_PER_GB_MONTH"])
result = {"ok": True, "located": True, "bucket_known": bucket, "metrics": {}, "findings": [], "errors": []}

# 這兩個值若出現在任何輸出文字中一律換成 <REDACTED>（雙保險，lib.sh 的 redact_secrets 沒涵蓋 R2 endpoint 格式）
account_id = os.environ.get("ACCOUNT_ID", "")
endpoint = os.environ.get("R2_ENDPOINT_URL", "")

def scrub(s):
    if account_id:
        s = s.replace(account_id, "<REDACTED>")
    if endpoint:
        s = s.replace(endpoint, "<REDACTED>")
    return s

try:
    proc = subprocess.run(
        ["rclone", "size", f"r2:{bucket}", "--json"],
        capture_output=True, text=True, timeout=60,
    )
    if proc.returncode == 0 and proc.stdout.strip():
        data = json.loads(proc.stdout)
        count = int(data.get("count", 0))
        nbytes = int(data.get("bytes", 0))
        gb = nbytes / (1024 ** 3)
        monthly_cost = round(gb * rate, 4)
        result["metrics"]["r2_bucket"] = bucket
        result["metrics"]["r2_total_objects"] = count
        result["metrics"]["r2_total_bytes"] = nbytes
        result["metrics"]["r2_monthly_cost_usd_estimate"] = monthly_cost
        result["findings"].append({
            "id": "B5",
            "level": "green",
            "title": f"R2 bucket {bucket} 共 {count} 物件、{gb:.2f} GB，估算月費 US${monthly_cost}",
            "detail": (
                f"牌價估算，非實際帳單。費率 US${rate}/GB/月（Cloudflare R2 儲存，2026-08 查得，過期需重新查證）。"
                "R2 egress 免費——這是相對 S3（傳輸費另計）的主要成本優勢，重流量的靜態資產適合遷移過來。"
            ),
            "evidence": f"count={count}, bytes={nbytes}",
        })
    else:
        msg = scrub((proc.stderr or proc.stdout or "").strip())[:300]
        result["ok"] = False
        result["errors"].append({"step": "B5_rclone_size", "message": (
            f"R2 bucket 已定位為 {bucket}（來源：taipei-gis-analytics "
            f"docs/handoff/read-path-cdn-imagery.md，非猜測），但 rclone size 失敗（rc={proc.returncode}）: {msg}"
        )})
except subprocess.TimeoutExpired:
    result["ok"] = False
    result["errors"].append({"step": "B5_rclone_size", "message": f"rclone size r2:{bucket} 逾時（60s）"})
except Exception as e:
    result["ok"] = False
    result["errors"].append({"step": "B5_rclone_size", "message": scrub(str(e))[:300]})

print(json.dumps(result, ensure_ascii=False))
PYEOF
)"
  R2_PY_RC=$?
  R2_ELAPSED=$(timer_elapsed "$R2_START")
  metrics_set "r2_check_duration_sec" "$R2_ELAPSED"

  if [ $R2_PY_RC -ne 0 ] || ! echo "$R2_PY_RESULT" | jq -e . >/dev/null 2>&1; then
    report_error_soft "python3 B5 收集主體非正常結束（rc=${R2_PY_RC}），R2 用量本輪缺漏"
  else
    r2_ok=$(echo "$R2_PY_RESULT" | jq -r '.ok')
    metrics_merge "$(echo "$R2_PY_RESULT" | jq -c '.metrics // {}')"
    findings_merge "$(echo "$R2_PY_RESULT" | jq -c '.findings // []')"
    if [ "$r2_ok" = "false" ]; then
      # R2 拿不到數字是已知限制（定位到但無 list 權限），依規格用 soft error：不拖累整體 ok
      echo "$R2_PY_RESULT" | jq -c '.errors // [] | .[]' 2>/dev/null | while IFS= read -r e; do
        echo "$e" >> "$ERRORS_FILE"
      done
      if [ ! -s "$FINDINGS_FILE" ] || ! grep -q '"id":"B5"' "$FINDINGS_FILE" 2>/dev/null; then
        finding_add "B5" "yellow" \
          "R2 bucket 已定位（mini-tw-pulse）但用量無法取得" \
          "rclone size 呼叫失敗，詳見 errors；不影響本輪其他項目，ok 維持 true。" \
          "見 errors.step=B5_rclone_size"
      fi
    fi
  fi
fi

write_report
