# Layer Manifest — Handoff

## 這個 feature 有沒有跨 repo 資料契約？

**沒有。** AR-22 是**純前端內部重構**：把 `mini-taiwan-pulse` 自己的登記簿收成單一
manifest，不新增資料表、不改 RPC、不動 PMTiles 產製、不碰 collector。

因此 CLAUDE.md 的「跨 repo 同步順序（上游先動、下游後動）」不適用，
`taipei-gis-analytics/docs/handoff/` 也**不需要**開 `layer-manifest.md`。

## 唯一的跨 repo 接觸面：`upstream` 欄位

`LayerManifestEntry.upstream` 的形狀完全沿用 `src/data/upstreamRegistry.ts` 的
`UpstreamRef`，內容是指向 `taipei-gis-analytics/docs/data-catalog/<theme>/<dataset_id>.md`
的 `datasetId`。

- **SSOT 仍在 taipei-gis-analytics**，本 repo 只存 bridge（layer_key → dataset_id）。
- `upstreamRegistry.ts` 原本由 `scripts/audit/06_apply_to_pulse.py` 從 `match_final.csv`
  產生。⚠️ 那支腳本**不在 analytics、就在本 repo**（`mini-taiwan-pulse/scripts/audit/`，
  舊敘述誤植為跨 repo）。搬進 manifest 的 key 不再由它管轄 —— 它只會覆蓋
  `HANDWRITTEN_UPSTREAM`，而那張表**現在是空的**（348/348 全在 manifest）。

  → ✅ **2026-08-12 已改寫**（[changelog](./changelog.md)）：從「重生並覆蓋
  `upstreamRegistry.ts`」改成「對帳 `layerManifest.ts` 的 `upstream` 欄位」——
  預設 dry-run 只報帳、`--apply` 也只改既有 entry 的 `status`/`datasets` 兩行，
  **永不新增或刪除 entry**（衍生血緣欄位另列人工判斷桶，不機械覆寫）。

  ⚠️ 三件接手前要知道的事：
  1. 原版讀的三個 CSV 在 session scratchpad，**目錄早已消失**；只有進了版控的
     `docs/audit/data_sources_match_final.csv` 活下來（`catalog_datasets.csv`
     原本讀進來就沒用到，改寫時移除）。
  2. 那份 CSV 是 **2026-07-01 凍結快照**（227 keys vs manifest 現在 348）。
     現況 dry-run：223 一致／2 不一致／2 只在 CSV／123 只在 manifest。
     兩筆不一致都是 **manifest 才是新的那一側**（`schools` 後來手修成
     `schools/HIGH`、`fireHydrants` 跟上游改名成 `hydrants`），
     所以**今天不能 `--apply`**，那會把兩筆改回舊值。要 apply 得先跑 01→05 重產 CSV。
  3. 只在 CSV 的 `slope` / `aspect` 是快照後改名成 `slopeVector` / `aspectVector`，
     不是遺漏。

## 消費者（本 repo 內）

改 manifest 會即時影響：

| 消費端 | 影響 |
|---|---|
| `LAYER_COLORS` | sidebar 圓點色、部分 paint fallback |
| `THEMES` / `SECTIONS` / `LAYER_LABELS` | 桌機 IconRailSidebar + 手機 LayerSidebar 的顯示文字與位置 |
| `LAYER_ICONS` | 桌機 sidebar 的 layer icon |
| `UPSTREAM_REGISTRY` | DataSourceBrowser / DataSourceModal 的資料血緣顯示 |
| `layerVisibilityStore` | key 全集從 `LAYER_COLORS` 派生（間接） |
| `/embed` 白名單 | `EMBED_ALLOWED_CONFIGS` 讀 `OVERLAY_REGISTRY`（Phase 1 未動） |

## 接手前先讀

1. `docs/development-rules.md` §4 完整觸點表 —— manifest 的欄位就是照那張表切的
2. `src/data/layerManifest.ts` 檔頭的「界線：什麼進 manifest、什麼不進」
3. [backlog.md](./backlog.md) 的「開始 Phase 2 之前必須先拍板的 4 件事」

## 驗收指令（每批搬移都要跑）

```bash
npx tsc -b            # 0 error（雙軌 Omit 護欄的三個方向都靠它）
npx vitest run        # 全綠；黃金快照 fixture 必須一位元未動
git diff --stat src/data/__tests__/__fixtures__/layer-golden.json   # 應該是空的
```

fixture 若真的需要更新（**只在確認變更是有意的時候**）：

```bash
npx vite-node scripts/preprocess/dump-layer-golden.ts
git diff src/data/__tests__/__fixtures__/layer-golden.json   # 逐行 review 再 commit
```

⚠️ 無腦重跑 dump = 把護欄拆掉。搬移階段的 fixture diff **預期永遠是空的**。
