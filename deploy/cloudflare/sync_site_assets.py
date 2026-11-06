#!/usr/bin/env python3
"""S3 deploy-assets → R2 mini-tw-pulse/site/：產生網址對照後只補差異。預設 dry-run。

  python3 deploy/cloudflare/sync_site_assets.py                  # dry-run：列出要補的檔
  python3 deploy/cloudflare/sync_site_assets.py --execute        # 真的寫入
  python3 deploy/cloudflare/sync_site_assets.py --manifest-only --manifest-out m.csv   # 只產對照、不碰 R2

流程：列 S3 deploy-assets（跳過輪替家族前綴）→ 下載 jp-medical／jp-heights／flight-trails／embed-rail 指標
→ 讀 rail.tar.gz 成員清單 → site_manifest.build_rows（--tree 預設 repo 根目錄）→ 逐檔比對 R2 metadata
`src-etag`，只上傳不同或缺少的檔。

守門（由 .gis-agent-system 的 copy_to_r2.py 沿用）：
- 預設 dry-run，`--execute` 才寫入；只寫 `site/` 前綴（唯一寫入點檢查）。
- R2 金鑰只收 R2_MIGRATION_*，不退回 R2_ACCESS_KEY_ID。
- 輪替家族（climate、global-maritime）不處理，由 sync-rotating.mjs 負責。
- 不刪 R2 任何物件；R2 上多出來的只列在報表。
環境變數：S3_ACCESS_KEY、S3_SECRET_KEY、S3_REGION、S3_BUCKET、R2_ENDPOINT_URL、
R2_MIGRATION_ACCESS_KEY_ID、R2_MIGRATION_SECRET_ACCESS_KEY（本機可用 --env-file 載入，不印值）。
有錯誤時 exit 1。
"""
from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import io
import json
import mimetypes
import os
import re
import sys
import tarfile
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import site_manifest  # noqa: E402

REPO = HERE.parents[1]
PREFIX = site_manifest.PREFIX
DEST_PREFIX = "site/"
CACHE = "public, max-age=3600, must-revalidate"
ROTATING = site_manifest.ROTATING
ENV_KEYS = {"S3_ACCESS_KEY", "S3_SECRET_KEY", "S3_REGION", "S3_BUCKET", "R2_ENDPOINT_URL",
            "R2_MIGRATION_ACCESS_KEY_ID", "R2_MIGRATION_SECRET_ACCESS_KEY"}  # 刻意不含 R2_ACCESS_KEY_ID
CT = {".pmtiles": "application/octet-stream", ".geojson": "application/geo+json", ".json": "application/json",
      ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".csv": "text/csv",
      ".gz": "application/gzip", ".bin": "application/octet-stream", ".arrow": "application/vnd.apache.arrow.file"}
# 指標檔：build_rows 的 ptrs 名稱 → S3 key（jpmed_pub 由 current.json 決定）
POINTERS = {"jp-medical_current.json": "jp-medical/current.json",
            "jp-heights_catalog.json": "jp-heights/catalog.json",
            "flight-trails_manifest.json": "flight-trails/manifest.json",
            "embed-rail_rail-manifest.json": "embed-rail/rail-manifest.json"}
RAIL_KEY = PREFIX + "rail.tar.gz"
MAX_MEMBER = 310 * 1024 * 1024


# ── 守門 ──
def load_env(path: Path):
    """只載入 ENV_KEYS；已存在的環境變數優先。不印任何值。"""
    if not path or not path.exists():
        return
    for line in path.read_text().splitlines():
        m = re.match(r"\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$", line)
        if m and m.group(1) in ENV_KEYS and m.group(1) not in os.environ:
            v = m.group(2).strip()
            if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
                v = v[1:-1]
            os.environ[m.group(1)] = v


def assert_site_key(key: str):
    if not key.startswith(DEST_PREFIX) or ".." in key.split("/") or "//" in key:
        raise SystemExit(f"拒絕：目的 key 必須以 {DEST_PREFIX} 開頭且不得含 ..：{key!r}")


def dest_key(served_path: str) -> str:
    key = DEST_PREFIX + served_path.lstrip("/")
    assert_site_key(key)
    return key


def family(p: str) -> str:
    parts = p.split("/")
    return parts[1] if len(parts) > 2 else "(root)"


def is_rotating(served_path: str) -> bool:
    return family(served_path) in ROTATING


def content_type(path: str) -> str:
    ext = os.path.splitext(path)[1].lower()
    return CT.get(ext) or mimetypes.guess_type(path)[0] or "application/octet-stream"


def safe_rel(p: str) -> str:
    if not isinstance(p, str) or not p or p.startswith("/") or ".." in p.split("/"):
        raise ValueError(f"不安全的指標路徑：{p!r}")
    return p


# ── 用戶端 ──
def clients(need_r2: bool, need_any_r2: bool = True):
    import boto3
    from botocore.config import Config
    cfg = Config(retries={"max_attempts": 5, "mode": "standard"}, connect_timeout=30, read_timeout=120,
                 request_checksum_calculation="when_required", response_checksum_validation="when_required")
    miss = [k for k in ("S3_ACCESS_KEY", "S3_SECRET_KEY", "S3_BUCKET") if not os.environ.get(k)]
    if miss:
        sys.exit(f"缺少環境變數：{', '.join(miss)}")
    s3 = boto3.client("s3", aws_access_key_id=os.environ["S3_ACCESS_KEY"],
                      aws_secret_access_key=os.environ["S3_SECRET_KEY"],
                      region_name=os.environ.get("S3_REGION") or None, config=cfg)
    if not need_any_r2:
        return s3, None
    r2need = ["R2_MIGRATION_ACCESS_KEY_ID", "R2_MIGRATION_SECRET_ACCESS_KEY", "R2_ENDPOINT_URL"]
    r2miss = [k for k in r2need if not os.environ.get(k)]
    if r2miss:
        if need_r2:
            sys.exit(f"缺少環境變數：{', '.join(r2miss)}。R2 只准用 R2_MIGRATION_* 這組，不會退回 R2_ACCESS_KEY_ID。")
        print(f"[警告] 缺少 {', '.join(r2miss)}：dry-run 無法檢查 R2 現況，一律當作『尚未存在』", file=sys.stderr)
        return s3, None
    r2 = boto3.client("s3", endpoint_url=os.environ["R2_ENDPOINT_URL"], region_name="auto", config=cfg,
                      aws_access_key_id=os.environ["R2_MIGRATION_ACCESS_KEY_ID"],
                      aws_secret_access_key=os.environ["R2_MIGRATION_SECRET_ACCESS_KEY"])
    return s3, r2


# ── 取得 build_rows 的輸入 ──
def list_s3(s3, bucket: str) -> dict[str, dict]:
    """列 deploy-assets/；根層用 delimiter 列，子前綴逐一分頁，跳過輪替家族（GFW 十幾萬檔）。"""
    objs: dict[str, dict] = {}
    pag = s3.get_paginator("list_objects_v2")

    def take(o):
        objs[o["Key"]] = {"size": o["Size"], "etag": o["ETag"].strip('"'),
                          "storage_class": o.get("StorageClass", "STANDARD")}

    prefixes = []
    for page in pag.paginate(Bucket=bucket, Prefix=PREFIX, Delimiter="/"):
        for o in page.get("Contents", []):
            take(o)
        prefixes += [cp["Prefix"] for cp in page.get("CommonPrefixes", [])]
    for p in prefixes:
        if p[len(PREFIX):].strip("/") in ROTATING:
            continue
        for page in pag.paginate(Bucket=bucket, Prefix=p):
            for o in page.get("Contents", []):
                take(o)
    # 依 key 字典序（= S3 全量列出的順序）：同一網址多對 key 時，site_manifest 取最後一個，順序要穩定
    return dict(sorted(objs.items()))


def get_json(s3, bucket: str, key: str):
    return json.loads(s3.get_object(Bucket=bucket, Key=key)["Body"].read())


def fetch_pointers(s3, bucket: str) -> dict:
    ptrs = {name: get_json(s3, bucket, PREFIX + key) for name, key in POINTERS.items()}
    pub = safe_rel(ptrs["jp-medical_current.json"]["publication_manifest"])
    ptrs["jpmed_pub.json"] = get_json(s3, bucket, f"{PREFIX}jp-medical/{pub}")
    return ptrs


def rail_member_list(s3, bucket: str, s3objs: dict) -> list[tuple[int, str]]:
    if RAIL_KEY not in s3objs:
        return []
    body = s3.get_object(Bucket=bucket, Key=RAIL_KEY)["Body"]
    out = []
    with tarfile.open(fileobj=body, mode="r|gz") as tf:
        for m in tf:
            if m.isfile():
                out.append((m.size, m.name))
    return out


def rail_path(member_name: str) -> str:
    return "/" + member_name.lstrip("./")  # 與 site_manifest.simulate 相同正規化


# ── 寫入 ──
class Writer:
    def __init__(self, r2, bucket: str, execute: bool):
        self.r2, self.bucket, self.execute = r2, bucket, execute

    def existing(self, key):
        """(大小, src-etag, R2 ETag) 或 None。"""
        if self.r2 is None:
            return None
        from botocore.exceptions import ClientError
        try:
            h = self.r2.head_object(Bucket=self.bucket, Key=key)
            return h["ContentLength"], (h.get("Metadata") or {}).get("src-etag"), h.get("ETag", "").strip('"')
        except ClientError as e:
            if e.response.get("Error", {}).get("Code") in ("404", "NoSuchKey", "NotFound"):
                return None
            raise

    @staticmethod
    def same(ex, size, etag, check_size=True) -> bool:
        return bool(ex) and ex[1] == etag and (not check_size or ex[0] == size)

    def put(self, key, fileobj, served_path, etag, s3key):
        assert_site_key(key)  # 唯一寫入點
        if not self.execute:
            raise RuntimeError("dry-run 不可寫入")
        from boto3.s3.transfer import TransferConfig
        self.r2.upload_fileobj(
            fileobj, self.bucket, key,
            ExtraArgs={"CacheControl": CACHE, "ContentType": content_type(served_path),
                       "Metadata": {"src-etag": etag, "src-key": s3key}},
            Config=TransferConfig(multipart_threshold=64 << 20, multipart_chunksize=32 << 20,
                                  max_concurrency=2, use_threads=True))


def plan_rows(rows: list[dict]) -> tuple[list, list, list, list]:
    """回傳 (plain, bus, rail, no_key)；輪替家族在這裡再擋一次。"""
    rows = [r for r in rows if not is_rotating(r["served_path"])]
    no_key = [r for r in rows if not r["s3_key"]]
    rows = [r for r in rows if r["s3_key"]]
    rail = [r for r in rows if r["s3_key"] == RAIL_KEY]
    bus = [r for r in rows if r["served_path"].startswith("/bus/") and r["s3_key"].endswith(".gz")]
    plain = [r for r in rows if r not in rail and r not in bus]
    return plain, bus, rail, no_key


def sync(rows, s3, bucket_s3, w: Writer, s3objs: dict, workers: int = 4) -> list[list]:
    """回傳 log：[served_path, dest_key, action, bytes, note]。action ∈ skip/would-copy/copied/missing-src/error。"""
    plain, bus, rail, _ = plan_rows(rows)
    log: list[list] = []
    execute = w.execute

    def rec(r, action, size, note=""):
        log.append([r["served_path"], dest_key(r["served_path"]), action, size, note])

    def do_plain(r):
        key, etag, size = dest_key(r["served_path"]), r["etag"], int(r["size"])
        try:
            if r["s3_key"] not in s3objs:
                return rec(r, "missing-src", 0, "S3 無此 key（指標指向不存在的檔）")
            if w.same(w.existing(key), size, etag):
                return rec(r, "skip", size, "etag 相同")
            if not execute:
                return rec(r, "would-copy", size)
            body = s3.get_object(Bucket=bucket_s3, Key=r["s3_key"])["Body"]
            w.put(key, body, r["served_path"], etag, r["s3_key"])
            rec(r, "copied", size)
        except Exception as e:  # noqa: BLE001
            rec(r, "error", size, f"{type(e).__name__}: {e}"[:200])

    def do_bus(r):
        key, etag = dest_key(r["served_path"]), r["etag"]
        try:
            if w.same(w.existing(key), 0, etag, check_size=False):
                return rec(r, "skip", 0, "etag 相同")
            if not execute:
                return rec(r, "would-copy", int(r["size"]), "gunzip（大小為壓縮大小）")
            body = s3.get_object(Bucket=bucket_s3, Key=r["s3_key"])["Body"]
            with gzip.GzipFile(fileobj=body) as gz:  # upload_fileobj 需可 seek → 先解到記憶體
                data = gz.read()
            w.put(key, io.BytesIO(data), r["served_path"], etag, r["s3_key"])
            rec(r, "copied", len(data), "gunzip")
        except Exception as e:  # noqa: BLE001
            rec(r, "error", 0, f"{type(e).__name__}: {e}"[:200])

    def do_rail():
        todo, existing = {}, {}
        for r in rail:
            p = r["served_path"]
            try:
                ex = w.existing(dest_key(p))
                if w.same(ex, int(r["size"]), r["etag"]):
                    rec(r, "skip", int(r["size"]), "etag 相同")
                else:
                    todo[p], existing[p] = r, ex
            except Exception as e:  # noqa: BLE001
                rec(r, "error", int(r["size"]), f"head: {e}"[:200])
        if not todo:
            return
        if not execute:
            for r in todo.values():
                rec(r, "would-copy", int(r["size"]), "rail.tar.gz 串流解包（實際寫入時內容相同者會略過）")
            return
        body = s3.get_object(Bucket=bucket_s3, Key=RAIL_KEY)["Body"]
        seen = set()
        with tarfile.open(fileobj=body, mode="r|gz") as tf:  # 純串流，不 seek
            for m in tf:
                if not m.isfile():
                    continue
                p = rail_path(m.name)
                r = todo.get(p)
                if r is None:
                    continue
                seen.add(p)
                if m.size > MAX_MEMBER:
                    rec(r, "error", m.size, "超過 310MB")
                    continue
                try:
                    data = tf.extractfile(m).read()
                    ex = existing[p]
                    # rail.tar.gz 重新打包但個別檔沒變：R2 單段上傳的 ETag 即 MD5，內容相同就不重傳
                    if ex and ex[0] == len(data) and ex[2] == hashlib.md5(data).hexdigest():
                        rec(r, "skip", m.size, "tar 已換版但內容相同（MD5）")
                        continue
                    w.put(dest_key(p), io.BytesIO(data), p, r["etag"], r["s3_key"])
                    rec(r, "copied", m.size)
                except Exception as e:  # noqa: BLE001
                    rec(r, "error", m.size, f"{type(e).__name__}: {e}"[:200])
        for p, r in todo.items():
            if p not in seen:
                rec(r, "error", int(r["size"]), "tar 內找不到此檔")

    # 可變指標檔（jp-medical/current.json、jp-heights/catalog.json、flight-trails/manifest.json）最後才寫：
    # 指標先於它指向的資產上線，或資產失敗後指標仍留存，都會讓前端讀到指向不存在檔案的版本。
    def is_pointer(r) -> bool:
        return "可變指標" in (r.get("note") or "")

    pointers = [r for r in plain if is_pointer(r)]
    plain = [r for r in plain if not is_pointer(r)]
    with ThreadPoolExecutor(max(1, min(workers, 4))) as ex:
        list(ex.map(do_plain, plain))
        list(ex.map(do_bus, bus))
    if rail:
        do_rail()
    # 同一資料夾（第一段路徑）的資產有任何失敗／缺來源，就不換該家族的指標
    bad_families = {row[0].split("/")[1] for row in log if row[2] in ("error", "missing-src") and row[0].count("/") >= 2}
    for r in pointers:
        family = r["served_path"].split("/")[1]
        if family in bad_families:
            rec(r, "error", int(r["size"]), "同家族資產未全部成功，不換指標")
        else:
            do_plain(r)
    return log


def r2_extras(r2, bucket: str, wanted: set[str]) -> list[tuple[str, int]]:
    """R2 site/ 有、對照表沒有的物件（排除輪替家族）。只列不刪。"""
    out = []
    for page in r2.get_paginator("list_objects_v2").paginate(Bucket=bucket, Prefix=DEST_PREFIX):
        for o in page.get("Contents", []):
            k = o["Key"]
            if is_rotating("/" + k[len(DEST_PREFIX):]) or k in wanted:
                continue
            out.append((k, o["Size"]))
    return out


def write_csv(path, header, rows):
    with open(path, "w", newline="", encoding="utf-8") as f:
        cw = csv.writer(f)
        cw.writerow(header)
        cw.writerows(rows)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--execute", action="store_true", help="真的寫入 R2（預設 dry-run）")
    ap.add_argument("--dry-run", action="store_true", help="（預設）只列計畫")
    ap.add_argument("--manifest-only", action="store_true", help="只產對照表，不連 R2")
    ap.add_argument("--tree", default=str(REPO), help="前端原始碼樹（預設本 repo 根目錄）")
    ap.add_argument("--r2-bucket", default="mini-tw-pulse")
    ap.add_argument("--workers", type=int, default=4, help="並行數（上限 4）")
    ap.add_argument("--env-file", help="本機用：從此檔載入 S3_*／R2_MIGRATION_*（不印值）")
    ap.add_argument("--manifest-out", help="輸出對照表 CSV")
    ap.add_argument("--log", help="輸出逐檔動作 CSV")
    ap.add_argument("--extras-out", help="輸出 R2 多出物件 CSV")
    args = ap.parse_args(argv)
    if args.execute and (args.dry_run or args.manifest_only):
        ap.error("--execute 不可與 --dry-run／--manifest-only 並用")

    t0 = time.time()
    if args.env_file:
        load_env(Path(args.env_file))
    s3, r2 = clients(need_r2=args.execute, need_any_r2=not args.manifest_only)
    bucket_s3 = os.environ["S3_BUCKET"]

    s3objs = list_s3(s3, bucket_s3)
    ptrs = fetch_pointers(s3, bucket_s3)
    rail_members = rail_member_list(s3, bucket_s3, s3objs)
    rows, _ = site_manifest.build_rows(Path(args.tree), s3objs, ptrs, rail_members)
    t_manifest = time.time() - t0
    if args.manifest_out:
        with open(args.manifest_out, "w", newline="", encoding="utf-8") as f:
            cw = csv.DictWriter(f, fieldnames=site_manifest.FIELDS)
            cw.writeheader()
            cw.writerows(rows)
    print(f"對照表：{len(rows)} 個網址（S3 列出 {len(s3objs)} 個 key，rail 成員 {len(rail_members)}），{t_manifest:.0f}s")
    if args.manifest_only:
        return 0

    w = Writer(r2, args.r2_bucket, args.execute)
    log = sync(rows, s3, bucket_s3, w, s3objs, args.workers)
    extras = r2_extras(r2, args.r2_bucket, {dest_key(r["served_path"]) for r in rows}) if r2 else []
    if args.log:
        write_csv(args.log, ["served_path", "dest_key", "action", "bytes", "note"], log)
    if args.extras_out:
        write_csv(args.extras_out, ["r2_key", "size"], extras)

    c = Counter(x[2] for x in log)
    nbytes = {a: sum(int(x[3]) for x in log if x[2] == a) for a in c}
    no_key = len(plan_rows(rows)[3])
    up = "copied" if args.execute else "would-copy"
    lines = [
        f"[{'EXECUTE' if args.execute else 'DRY-RUN'}] 檢查 {len(log)} 檔（另有 {no_key} 個網址 S3 本來就沒有）",
        f"- {'上傳' if args.execute else '待上傳'}：{c[up]} 檔，{nbytes.get(up, 0) / 1e6:.1f} MB",
        f"- 略過（相同）：{c['skip']} 檔",
        f"- S3 缺檔：{c['missing-src']}；錯誤：{c['error']}",
        f"- R2 site/ 多出（只列不刪）：{len(extras)} 檔",
        f"- 耗時 {time.time() - t0:.0f}s（對照表 {t_manifest:.0f}s）",
    ]
    for x in log:
        if x[2] in (up, "error", "missing-src"):
            lines.append(f"  {x[2]}: {x[0]} {x[4]}".rstrip())
    print("\n".join(lines))
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as f:
            f.write("### site assets S3 → R2\n\n```\n" + "\n".join(lines[:200]) + "\n```\n")
    return 1 if c["error"] else 0


if __name__ == "__main__":
    sys.exit(main())
