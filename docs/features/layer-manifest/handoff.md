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
  產生。⚠️ **搬進 manifest 的 key 不再由該腳本管轄** —— 若上游重跑那支腳本，
  它只會覆蓋 `HANDWRITTEN_UPSTREAM`，manifest 裡的 5 筆（Phase 2 後會是全部）不受影響。
  這是有意的（manifest 是新 SSOT），但**該腳本需要在 Phase 2 收尾時同步改寫**，
  否則會出現「腳本產出的 diff 看起來少了很多層」的困惑。

  → 已登記在 [backlog.md](./backlog.md) Phase 5。

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
