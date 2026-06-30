# Data Sources SSOT Bridge — 計畫書

> 建立日期：2026-06-30
> 目標：讓 mini-taiwan-pulse 每個 layer 都能追溯到「最原始上游資料來源」，並建立可程式化讀取的 SSOT。
> 執行者：Claude（用戶授權自主對抗式驗證，盡量不介入）
> 預估總工時：~8 小時跨多 session

---

## 0. 背景與決策（已拍板）

### 整體架構（方案 B）
```
[人類維護 SSOT]
taipei-gis-analytics/docs/data-catalog/*.md   ← 唯一真相 (frontmatter)
                                              ← 289 筆 dataset 已存在
        ↓ GitHub Action on merge to main
        ↓ scripts/sync_catalog_to_supabase.py
        ↓ parse frontmatter → upsert

[Schema 在 gis-platform]
gis-platform/migrations/XXX_create_data_catalog.sql
  → reference.data_catalog (table)
  → public.get_data_catalog_for_layer() (RPC)

[前端消費]
mini-taiwan-pulse
  → src/data/dataCatalogLoader.ts（走 RPC）
  → C 方案 UI：新 icon「資料來源總覽」浮窗
```

### 為什麼 SSOT 不是 Supabase
- Git diff review、離線可讀、回滾容易、AI / claude 直接讀 markdown
- Supabase 表是「鏡像 / API 層」，不是真相本身

### 三個 repo 的職責
| Repo | 角色 |
|---|---|
| **taipei-gis-analytics** | SSOT — `docs/data-catalog/` 維護 289 筆 dataset frontmatter |
| **gis-platform** | Supabase schema — `reference.data_catalog` table + `public.*` RPC |
| **mini-taiwan-pulse** | 消費端 — layerCatalog 加 `upstreamDatasetId`，UI 顯示來源 |

---

## 1. 範圍

**本計畫只涵蓋 Step 1**：建立 layer ↔ dataset 雙向配對，並寫入兩邊 SSOT。
- Step 2（gis-platform migration）、Step 3（sync script）、Step 4（前端 UI）是後續獨立計畫，本文不涵蓋。

---

## 2. 防瞎猜的核心規則（⚠️ 必守）

| 規則 | 內容 |
|---|---|
| **R-1 數字必從腳本** | 任何「總數 / 覆蓋率」陳述都要附「產生這個數字的腳本路徑 + 執行時間」，不准引用 agent 記憶或印象 |
| **R-2 配對必附證據** | 每筆 layer↔dataset 配對必有 `rule` 與 `evidence` 欄位，evidence 是可粘貼進 grep 驗證的字串 |
| **R-3 對抗式驗證** | Claude 自己當魔鬼代言人，每個 HIGH 配對抽 20%、MED 配對 100% 反向 grep 驗證證據真實性，找出反例 |
| **R-4 雙向反證** | 寫完後做雙向掃描：catalog 提到的 layer 在 pulse 必存在；pulse 寫的 dataset_id 在 catalog 必存在 |
| **R-5 UNMATCHED 不准放著** | 每筆未配對必標 4 種 STATUS 之一：`catalog_missing` / `pulse_only` / `multi_dataset` / `name_mismatch` |
| **R-6 不准 git commit** | 所有寫入動作（catalog frontmatter / pulse layerCatalog）只產 diff 給用戶 review，不自動 commit |
| **R-7 跨資料源查證** | 不確定的 upstream 機關 / dataset_id 真實性可用：WebFetch 該機關開放資料平台、twinkle-hub catalog、`catalog-search` skill |

---

## 3. 執行階段

### Phase 1 — 精確基線盤點

**輸出物**：
- `/scratchpad/audit/pulse_layers.csv`
- `/scratchpad/audit/catalog_datasets.csv`
- `/scratchpad/audit/01_baseline_report.md`

**腳本**：
1. `scripts/audit/01_enumerate_pulse_layers.ts`（在 mini-taiwan-pulse）
   - 解析 `src/components/sidebar/layerCatalog.ts` SECTIONS（用 TypeScript AST 而不是 regex）
   - 對每個 layer_key join `src/map/overlayRegistry.ts` 拿 sourceUrl
   - 對每個 layer_key grep `src/hooks/use*Layer.ts` 與 `src/data/*Loader.ts` 找關聯
   - 推導 source_type：`static_geojson | pmtiles | supabase_rpc | external_api | three_only`
   - 輸出欄位：`layer_key, section, chinese_label, loader_file, rpc_name, source_url, source_type`

2. `scripts/audit/02_enumerate_catalog_datasets.py`（在 taipei-gis-analytics）
   - 用 `python-frontmatter` parse `docs/data-catalog/**/*.md`
   - 排除：`_template.md`、`README.md`、任何 index 類
   - 輸出欄位：`dataset_id, theme, subtopic, provider_agency, lifecycle, supabase_schema, supabase_table, collectors, paths_processed`

**驗證 Gate 1（Claude 自己做）**：
- [ ] CSV 行數 == 兩種獨立計數法的結果（grep `key:` 與 AST 計數對帳）
- [ ] 每個 section / theme 的分布表存在
- [ ] 對抗式檢查：抽 5 個 layer_key 反向去 layerCatalog.ts grep 確認真的存在
- [ ] 對抗式檢查：抽 5 個 dataset_id 反向去 catalog 對應檔確認 frontmatter 正確
- [ ] 與 explore agent 之前回報的數字（pulse 227 / catalog 289）比對，差異 > 5% 必須解釋原因

**通過後**：寫 `01_baseline_report.md`，記錄精確數字與分布，進 Phase 2。

---

### Phase 2 — 機械化自動配對

**輸出物**：
- `/scratchpad/audit/match_proposal.csv`
- `/scratchpad/audit/02_proposal_report.md`

**腳本** `scripts/audit/03_propose_matches.ts`，套 4 條規則（**由強到弱**）：

| 規則 | 條件 | Confidence |
|---|---|---|
| **R1** | layer.rpc_name == catalog.supabase_table（去 `get_` `fetch_` `_daily` 前後綴） | HIGH |
| **R2** | layer.source_url basename == catalog.paths.processed basename | HIGH |
| **R3** | layer.loader_file 引用的 collector path == catalog.collectors[] | HIGH |
| **R4** | layer_key normalize（snake_case / 全小寫 / 去 `Layer` 後綴）== dataset_id normalize | MED |

每筆輸出：
```
layer_key, dataset_id, rule, confidence, evidence, alt_candidates
```

**驗證 Gate 2（Claude 自己做）**：
- [ ] 每筆 layer 只有 0 或 1 個 proposed match（一對多放 `alt_candidates`）
- [ ] 統計表：HIGH / MED / UNMATCHED 各幾筆 + 覆蓋率
- [ ] **對抗式檢查**：HIGH 抽 10 筆，把 evidence 字串貼回去 grep，驗證真的對得上（找反例）
- [ ] HIGH 占比 < 60% → 回頭檢查規則是否寫漏（例如 RPC 命名規律沒涵蓋）
- [ ] 一個 dataset 被指 > 3 次 → 標記為「熱門 dataset」，人工 review 時優先看

**通過後**：寫 `02_proposal_report.md`，進 Phase 3。

---

### Phase 3 — Claude 自主 review + 補洞

> ⚠️ 用戶授權 Claude 自己決定，本階段不等用戶 review。Claude 必須對抗式驗證 + 必要時上網查 + 用 twinkle-hub。

**對 HIGH 配對**：
- 抽 30%（不是 20%，提高保險）做反向 grep
- 找一筆故意「看起來像對但其實錯」的反例（魔鬼代言人）
- 若找不到反例，標 `verified_by_claude: true`

**對 MED 配對**：
- 100% 逐筆 review，比對：
  - layer 的中文 label vs dataset 的 title
  - layer 的 source_type vs dataset 的 lifecycle
  - 必要時 Read catalog `.md` 全文確認
- 標 `verified_by_claude: true / false + reason`

**對 UNMATCHED 配對**：每筆分類為 4 種 STATUS：

| STATUS | 處理方式 |
|---|---|
| `catalog_missing` | catalog 真的沒登錄。記在 `pending_catalog_additions.md`，**不阻擋本計畫**，留給後續補登 |
| `pulse_only` | pulse 內建 demo / 純前端 layer（如 base map style switcher）。標註原因 |
| `multi_dataset` | 一個 layer 整合多個 dataset。列出所有對應 dataset_id 陣列 |
| `name_mismatch` | catalog 確實有對應，但名字不同。Claude 手動配對 + evidence |

**Claude 的查證工具**：
- WebFetch：查機關開放資料平台確認 dataset 真實存在（如 https://opendata.cwa.gov.tw）
- `catalog-search` skill：搜 master_catalog.sqlite 7.4 萬筆政府資料對證
- `gis-lookup-router` skill：路由判斷該用哪個查證管道
- twinkle-hub MCP：若可用，查跨平台鏡像

**輸出物**：
- `/scratchpad/audit/match_verified.csv`（最終配對表，每筆都有 verified_by_claude）
- `/scratchpad/audit/pending_catalog_additions.md`（catalog 待補清單，給用戶看）
- `/scratchpad/audit/03_review_report.md`

**驗證 Gate 3（Claude 自己做）**：
- [ ] `match_verified.csv` 每筆都有 `verified_by_claude` 欄（不准空白）
- [ ] UNMATCHED 全部分類完成
- [ ] 反向驗證腳本通過：每個 verified=true 的 dataset_id 真的存在於 catalog `.md`
- [ ] 反向驗證腳本通過：每個 verified=true 的 layer_key 真的存在於 layerCatalog.ts
- [ ] 統計：verified / pulse_only / catalog_missing / multi_dataset 數字加總 = Phase 1 layer 總數

**只有在 catalog_missing > 20%（即 50+ 筆）才回報用戶**，否則直接進 Phase 4。

---

### Phase 4 — 雙向寫入兩邊 SSOT

**動作 A：寫入 taipei-gis-analytics**

腳本 `scripts/audit/05_apply_to_catalog.py`：
- 對每個 catalog `.md` upsert frontmatter：
  ```yaml
  used_by_pulse_layers: [cwaRadar, cwaRadarComposite]
  ```
- 用 `python-frontmatter` 保留原始排序、註解、空行
- 不直接 commit，產 `git diff` 寫到 `/scratchpad/audit/catalog_diff.patch`

**動作 B：寫入 mini-taiwan-pulse**

決策：用「獨立 registry 檔」而非污染 layerCatalog.ts。
- 新建 `src/data/upstreamRegistry.ts`：
  ```ts
  export const UPSTREAM_REGISTRY: Record<LayerKey, UpstreamRef> = {
    cwaRadar: { datasetId: 'cwa_radar_integrated_echo' },
    waterReservoirs: { datasetId: 'reservoirs', additionalDatasets: ['xxx'] },
    // ...
  };
  ```
- 型別與既有 `LayerKey` 對齊

**動作 C：寫一致性 lint**

`scripts/audit/07_check_consistency.ts`：
- 雙向掃描：
  - catalog 提到的每個 layer_key 在 pulse 必存在
  - pulse 寫的每個 datasetId 在 catalog 必存在
- 加進 `pnpm test`（類似 `layerConsistency`）

**驗證 Gate 4（Claude 自己做）**：
- [ ] `npx tsc -b` 在 pulse 端通過
- [ ] `07_check_consistency.ts` 跑 0 error
- [ ] 反向算式：catalog 提及 layer 總數（含陣列展開） == pulse UPSTREAM_REGISTRY 非空筆數
- [ ] git diff 看過，找出任何「明顯破壞既有結構」的改動

**輸出物**：
- pulse 端：`src/data/upstreamRegistry.ts`（新檔）+ `scripts/audit/07_check_consistency.ts` + 測試
- taipei-gis-analytics：`/scratchpad/audit/catalog_diff.patch` 給用戶 apply

---

### Phase 5 — 最終驗證報告

**輸出** `docs/audit/data-sources-coverage.md`（最終交付物，要進 git）：

```markdown
# 資料來源配對結果（YYYY-MM-DD）

## 數字總表
（從 match_verified.csv 算）

## 配對信心分布
（HIGH / MED / 人工）

## 未配對清單
（catalog_missing / pulse_only / multi_dataset / name_mismatch 各自的表）

## 驗證方法
（哪些用 grep、哪些用 WebFetch、哪些用 catalog-search）

## 後續 Step 2-4 入口
（gis-platform migration 在哪 / sync script 在哪 / 前端 UI 在哪）
```

**最終 Gate**：
- [ ] 報告數字加總 == Phase 1 layer 總數
- [ ] 用戶 review 後拍板，本計畫 Step 1 完成

---

## 4. Session 接力協議

> 本計畫橫跨多 session，每次回來 Claude 必須讀本檔 + 檢查進度。

**Session 結束時必更新**：本檔最底「進度檢核」段。

**Session 開始時必做**：
1. 讀本檔 §5「進度檢核」找上次斷點
2. 讀 `/scratchpad/audit/` 最新輸出物確認狀態
3. 從上次斷點往下繼續

---

## 5. 進度檢核（Live Status）

| Phase | 狀態 | 完成時間 | 輸出物路徑 | 備註 |
|---|---|---|---|---|
| 1. 基線盤點 | ✅ 完成 | 2026-06-30 | scratchpad/audit/{pulse_layers.csv, catalog_datasets.csv, 01_baseline_report.md} | pulse=227 / catalog=261，frontend_target=39 金礦 |
| 2. 自動配對 | ✅ 完成 | 2026-07-01 | scratchpad/audit/{match_proposal.csv, 02_proposal_report.md} | R0-R5 規則，85 配對（HIGH 15 / MED 33 / LOW 37）|
| 3. Claude review | ✅ 完成 | 2026-07-01 | scratchpad/audit/{match_final.csv, hunt_results.csv, 03_review_report.md} | 175 verified (77.1%)，HIGH 抽 10/10、MED 8/10 |
| 4. 雙向寫入 | ✅ 完成 | 2026-07-01 | `src/data/upstreamRegistry.ts` + test + catalog_diff.patch | tsc 0 / 159 tests pass；catalog 端 dry-run 待 apply |
| 3.5. pulse_only 修正 | ✅ 完成 | 2026-07-01 | scratchpad/audit/08_pulse_only_fix_report.md | 30 個錯標 pulse_only 重新分類，加 derivedFrom/processing 欄位 |
| 3.6. 對抗式 review | ✅ 完成 | 2026-07-01 | scratchpad/audit/09_adversarial_review_report.md | agent 找到 4 誤判 + 1 漏判，全部驗證並修正 |
| 5. 最終報告 | ✅ 完成 | 2026-07-01 | `docs/audit/data-sources-coverage.md` + `data_sources_match_final.csv` + `data_sources_pending_catalog.md` | 入 git |

**最後更新**：2026-07-01（Step 1 全部完成，含 Phase 3.5/3.6 自我修正迭代）
**最終數字**：185 verified (81.5%) / 3 pulse_only / 39 catalog_missing；159/159 tests pass
**下一步**：用戶決定 — (a) `python3 scripts/audit/07_apply_to_catalog.py --apply` 寫 catalog；(b) 進 Step 2 開始 gis-platform migration

---

## 6. 後續 Step（本計畫之後）

| Step | 內容 | Repo |
|---|---|---|
| Step 2 | `reference.data_catalog` table + `public.get_data_catalog_for_layer()` RPC | gis-platform |
| Step 3 | `scripts/sync_catalog_to_supabase.py` + GitHub Action | taipei-gis-analytics |
| Step 4 | 前端「資料來源」icon + 浮窗 UI | mini-taiwan-pulse |

每個 Step 各自獨立計畫書。
