#!/usr/bin/env bash
# SessionStart hook：將 memory/ 的核心入口摘要作為 additionalContext
# 注入到新 session，Agent 開頭就有現況可讀，但不把長文全文塞進 context。
#
# 由 .claude/settings.json 的 SessionStart hook 呼叫。
# 用 python3 產 JSON（不依賴 jq）。

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_ROOT"

# 輕量載入策略（2026-06-30）：
#   舊版把 STATUS + BACKLOG + PRINCIPLES 三檔「全文」inline，約 98k 字元
#   （≈25k tokens），每個 session 開頭就吃掉大量 context。
#
#   新版只 inline STATUS 的「檔頭 + 最新 H2 段落」（接上次結束點的關鍵），
#   BACKLOG / PRINCIPLES 改成只注入「標題索引（H1~H3，含行號）」，
#   需要時主 Agent 再用 Read 讀全文 / 特定段落。
#   目前約降到 ~6k 字元（省 >90% context），且每段有上限防止再次膨脹。
#
#   可用 mode：
#     - "latest": 檔頭 + 最新 H2 段落（適合 STATUS）
#     - "toc":    標題索引（適合 BACKLOG / PRINCIPLES）
#     - "full":   全文，但仍受 MAX_FULL_CHARS 保護

python3 - <<'PY'
import json, re

MAX_STATUS_CHARS = 8_000
MAX_TOC_ITEMS = 80
MAX_FULL_CHARS = 12_000

def read_or_empty(path):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        return f"(檔案不存在：{path})"

def trim_to_chars(text, max_chars):
    if len(text) <= max_chars:
        return text

    trimmed = text[:max_chars]
    last_newline = trimmed.rfind("\n")
    if last_newline > max_chars * 0.8:
        trimmed = trimmed[:last_newline]
    return trimmed.rstrip() + f"\n\n…（已截斷：原文 {len(text)} 字元；請 Read 原檔取得完整內容）"

def latest_h2_section(text, max_chars=MAX_STATUS_CHARS):
    """保留檔頭（H1 + metadata）與第一個 H2 區塊，避免 STATUS 越長越重。"""
    lines = text.splitlines()
    h2_indices = [i for i, line in enumerate(lines) if re.match(r"^##\s+", line)]
    if not h2_indices:
        return trim_to_chars(text, max_chars)

    first_h2 = h2_indices[0]
    next_h2 = h2_indices[1] if len(h2_indices) > 1 else len(lines)
    selected = lines[:next_h2]
    omitted = max(0, len(lines) - next_h2)
    body = "\n".join(selected).rstrip()
    if omitted:
        body += f"\n\n…（已省略 STATUS 舊段落 {omitted} 行；需要歷史紀錄請 Read .claude/memory/STATUS.md）"
    return trim_to_chars(body, max_chars)

def toc(text, max_level=3, max_items=MAX_TOC_ITEMS):
    """抽出 markdown 標題當索引，行號方便 Read 定位。"""
    lines = []
    for i, line in enumerate(text.splitlines(), start=1):
        m = re.match(r"^(#{1,%d})\s+(.*)$" % max_level, line)
        if m:
            indent = "  " * (len(m.group(1)) - 1)
            lines.append(f"{indent}- (L{i}) {m.group(2).strip()}")
            if len(lines) >= max_items:
                lines.append(f"…（標題超過 {max_items} 筆已截斷；請 Read 原檔取得完整索引）")
                break
    return "\n".join(lines) if lines else "(無標題)"

# (路徑, 標題, 模式)
FILES = [
    (".claude/memory/STATUS.md", "STATUS.md（最新狀態摘要，接上次結束點）", "latest"),
    (".claude/memory/BACKLOG.md", "BACKLOG.md（待辦索引，需要時 Read 全文）", "toc"),
    (".claude/memory/PRINCIPLES.md", "PRINCIPLES.md（P0 規則索引，需要時 Read 對應段）", "toc"),
]

parts = [
    "## Mini Taiwan Pulse — Session 記憶已載入\n",
    "STATUS 僅 inline 最新段落；BACKLOG / PRINCIPLES 僅注入標題索引以節省 context，",
    "需要細節時用 Read 讀對應檔案 / 行號。完整 9 檔見 `.claude/memory/` 或 `.claude/FRAMEWORK.md`。\n",
]

for path, title, mode in FILES:
    body = read_or_empty(path)
    if body.startswith("(檔案不存在"):
        header = f"=== {title} — 缺檔 ==="
    elif mode == "toc":
        body = toc(body)
        header = f"=== {title} — 標題索引 ==="
    elif mode == "latest":
        body = latest_h2_section(body)
        header = f"=== {title} — 最新段落 ==="
    else:
        body = trim_to_chars(body, MAX_FULL_CHARS)
        header = f"=== {title} — 全文 ==="
    parts.append(f"\n{header}\n{body}")

context = "\n".join(parts)

print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "SessionStart",
        "additionalContext": context,
    }
}, ensure_ascii=False))
PY
