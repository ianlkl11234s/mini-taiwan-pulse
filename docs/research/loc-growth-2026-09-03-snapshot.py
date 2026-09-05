#!/usr/bin/env python3
"""程式碼規模成長曲線 — 每週 first-parent 快照 + cloc 分桶。

用法：SCRATCH=/tmp/loc python3 loc-growth-2026-09-03-snapshot.py
產出：$SCRATCH/loc_growth.csv

方法與踩雷點見 loc-growth-2026-09-03.md。重點：
  - 全程不 checkout（git archive 到暫存目錄），工作區不動
  - 排除 public/、.json/.geojson/.pmtiles/圖檔（wc -l 對二進位檔會產生垃圾數字）
  - 走 --first-parent，分支開發期會出現水平段，那是 master 的真實狀態
"""
import datetime, subprocess, json, os, shutil, csv

REPO = os.environ.get("REPO", os.path.dirname(os.path.abspath(__file__)) + "/../..")
SCRATCH = os.environ["SCRATCH"]
WORK = os.path.join(SCRATCH, "snaps")
ARCHIVE_PATHS = ["src", "scripts", "docs", ".claude"]
ROOT_MD = ["README.md", "CLAUDE.md", "AGENTS.md"]
START = datetime.date(2026, 2, 20)
STEP_DAYS = 7

CODE_EXT = {".ts", ".tsx", ".js", ".jsx", ".py", ".sql", ".css", ".sh", ".frag", ".vert", ".html"}
SKIP_EXT = {".json", ".geojson", ".csv", ".png", ".jpg", ".pmtiles", ".yml", ".yaml", ".toml"}


def git(*args):
    return subprocess.run(["git", "-C", REPO, *args], capture_output=True, text=True).stdout.strip()


def bucket(path):
    ext = os.path.splitext(path)[1]
    if ext in SKIP_EXT or path.startswith("public/"):
        return None
    if ext == ".md":
        return "agent_md" if path.startswith(".claude/") else "docs_md"
    if ext in CODE_EXT:
        p = path.replace("\\", "/")
        if "__tests__/" in p or "/tests/" in p or ".test." in p or ".spec." in p or p.startswith("tests/"):
            return "tests"
        return "code"
    return None


def snapshot(sha):
    d = os.path.join(WORK, sha[:10])
    shutil.rmtree(d, ignore_errors=True)
    os.makedirs(d)
    present = [p for p in ARCHIVE_PATHS + ROOT_MD
               if subprocess.run(["git", "-C", REPO, "cat-file", "-e", f"{sha}:{p}"],
                                 capture_output=True).returncode == 0]
    if not present:
        return None
    tar = subprocess.run(["git", "-C", REPO, "archive", sha, "--", *present], capture_output=True)
    subprocess.run(["tar", "-x", "-C", d], input=tar.stdout, check=True)
    out = subprocess.run(["cloc", d, "--json", "--by-file", "--quiet"], capture_output=True, text=True).stdout
    if not out.strip():
        shutil.rmtree(d)
        return None
    agg = {}
    for k, v in json.loads(out).items():
        if k in ("header", "SUM"):
            continue
        b = bucket(os.path.relpath(k, d))
        if not b:
            continue
        e = agg.setdefault(b, {"code": 0, "comment": 0, "blank": 0, "files": 0})
        e["code"] += v["code"]; e["comment"] += v["comment"]
        e["blank"] += v["blank"]; e["files"] += 1
    shutil.rmtree(d)
    return agg


def main():
    points, d = [], START
    today = datetime.date.today()
    while d <= today:
        sha = git("rev-list", "-1", "--first-parent", f"--before={d.isoformat()} 23:59:59", "master")
        if sha:
            points.append((d.isoformat(), sha))
        d += datetime.timedelta(days=STEP_DAYS)
    head = git("rev-parse", "master")
    if points and points[-1][1] != head:
        points.append((git("log", "-1", "--format=%ad", "--date=short", head), head))

    os.makedirs(WORK, exist_ok=True)
    rows = []
    for sample_date, sha in points:
        agg = snapshot(sha) or {}
        g = lambda b, f: agg.get(b, {}).get(f, 0)
        rows.append(dict(
            sample_date=sample_date,
            commit_date=git("log", "-1", "--format=%ad", "--date=short", sha),
            sha=sha[:10],
            commits=int(git("rev-list", "--count", "--first-parent", sha)),
            code=g("code", "code"), code_files=g("code", "files"),
            code_comment=g("code", "comment"), code_blank=g("code", "blank"),
            tests=g("tests", "code"), test_files=g("tests", "files"),
            docs_md=g("docs_md", "code"), docs_files=g("docs_md", "files"),
            agent_md=g("agent_md", "code"), agent_files=g("agent_md", "files"),
        ))
        print(f"{sample_date} {sha[:10]} code={rows[-1]['code']:7d} tests={rows[-1]['tests']:6d} "
              f"docs={rows[-1]['docs_md']:6d} agent={rows[-1]['agent_md']:6d}", flush=True)

    out_csv = os.path.join(SCRATCH, "loc_growth.csv")
    with open(out_csv, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader(); w.writerows(rows)
    print("\nCSV ->", out_csv)


if __name__ == "__main__":
    main()
