---
description: 產生跨 repo commit 對照表，快速盤點某 feature 在 taipei-gis-analytics / gis-platform / data-collectors / mini-taiwan-pulse 的最新變動
argument-hint: <feature-slug> [--since=YYYY-MM-DD]
---

# /handoff

盤點某 feature 在整條 pipeline（upstream → downstream）的跨 repo 狀態。用於：
- 準備開 PR 前確認上下游對得起來
- 資料契約要改前確認影響哪些 repo
- 開新 handoff.md 前收集素材

## 參數

- `$1` (必填)：feature slug（與 `docs/features/<slug>/` 一致），例如 `real-estate` / `fire-rescue`
- `--since=YYYY-MM-DD` (選填)：只看該日之後的 commit，預設近 30 天

## 執行步驟

Claude 收到後執行以下（用 Bash / Read，**不要**修改任何檔案）：

### Step 1 — 讀對應文件

```bash
# 下游 feature 資料夾
cat docs/features/$1/README.md
cat docs/features/$1/changelog.md
cat docs/features/$1/handoff.md
cat docs/features/$1/backlog.md 2>/dev/null

# 上游 handoff SSOT
cat ../taipei-gis-analytics/docs/handoff/$1.md 2>/dev/null || echo "上游 handoff 尚未建"
```

### Step 2 — 掃 4 repo 的相關 commit

```bash
SINCE="${2:-30 days ago}"
SLUG="$1"

echo "=== mini-taiwan-pulse ==="
git log --oneline --since="$SINCE" | grep -iE "$SLUG|${SLUG//-/[-_ ]}"

echo "=== taipei-gis-analytics ==="
(cd ../taipei-gis-analytics && git log --oneline --since="$SINCE" | grep -iE "$SLUG")

echo "=== gis-platform ==="
(cd ../gis-platform && git log --oneline --since="$SINCE" | grep -iE "$SLUG")

echo "=== data-collectors ==="
(cd ../data-collectors && git log --oneline --since="$SINCE" | grep -iE "$SLUG")
```

### Step 3 — 檢查漂移

- 上下游 handoff 有沒有指到同一個 S3 path / RPC / migration #
- changelog 最後日期 vs 各 repo 最新 commit 日期是否吻合
- 有沒有「上游改了但下游沒跟」的欄位

### Step 4 — 產出報告

Claude 用 markdown 表格回報：

```
## Feature: <slug>

### 4 repo 近況
| Repo | 最新相關 commit | 未 push? |
|---|---|---|
| mini-taiwan-pulse | ... | Yes/No |
| taipei-gis-analytics | ... | ... |
| gis-platform | ... | ... |
| data-collectors | ... | ... |

### 契約狀態
- Upstream handoff：✅/⚠️/❌
- Downstream handoff.md 反向引用：✅/❌
- 硬依賴欄位對得上：✅/⚠️/❌ (列缺項)

### 建議動作
- [ ] ...
```

## 範例

```
/handoff real-estate
/handoff fire-rescue --since=2026-06-01
```

## 不做

- ❌ 不改任何檔案（純 read-only 盤點）
- ❌ 不決定要不要改 → 只列狀態給用戶判斷
- ❌ 若 feature 資料夾不存在 → 提示先建 `cp -r docs/features/_TEMPLATE docs/features/<slug>`

## Related

- `docs/features/<slug>/` — 下游 feature 文件
- `../taipei-gis-analytics/docs/handoff/<slug>.md` — 上游 SSOT
- Skill：`layer-onboarding` Step 5（跨 repo 對齊）
- CLAUDE.md §Git Workflow §跨 repo 同步順序
