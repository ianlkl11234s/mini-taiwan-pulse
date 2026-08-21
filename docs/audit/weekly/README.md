# Weekly Audit — 每週巡檢報告

> 每週一份，ISO 週編號（`YYYY-Www.md`）。跑法：對 Claude 說 `/weekly-audit`。
> 設計依據：[`docs/proposal/weekly-audit-2026-08-21/README.md`](../../proposal/weekly-audit-2026-08-21/README.md)

## 這裡放什麼

上線之後的**持續健康度**：圖層還有沒有資料、線上資產還在不在、Supabase 長多大、
效能有沒有退化、文件有沒有跟上、結構有沒有跑掉。

不放：單次 feature 的驗收（→ `docs/features/<slug>/`）、
session 收尾（→ `.claude/memory/STATUS.md`）、一次性稽核（→ `docs/audit/` 頂層）。

## 趨勢表

每週報告產出後追加一列。數字直接來自該週報告，**不依賴 `.claude/.cache/`**
（cache 不進版控，換機器就沒了；報告進版控，才是可靠的比較基準）。

| 週次 | Supabase | live schema | 慢 RPC(>200ms) | 真斷更表 | 線上 404 | 孤兒資產 | 🔴 | 🟡 |
|---|---|---|---|---|---|---|---|---|
| [2026-W34](2026-W34.md) | 37 GB | 509 表 / 33 GB | 40（無基準） | 0 | 2（刻意下架） | 41 / 809 MB | 0 | 15 |

## 怎麼讀報告

| 級別 | 意思 | 處置 |
|---|---|---|
| 🔴 | 資料斷更／線上 404／成本異常跳升／安全 | **停下來問**，不自行處置 |
| 🟡 | 需要判斷或有成本，不緊急 | 進報告 + append 到 `.claude/memory/BACKLOG.md` |
| 🟢 | 純整潔問題 | 依白名單自動修（分開 commit，可單獨 revert） |

收集器失敗時報告會標 `blocked`，**不會**因為沒收到資料就寫成「無異常」。
