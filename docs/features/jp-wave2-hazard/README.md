# 日本第二波圖層（jp-wave2-hazard）

> **狀態**：本機完成（2026-10-26，分支 `feat/jp-tab-systems`，未 push、未開 PR）；瀏覽器驗收與 S3 上傳待合併。
> **上游契約**：`taipei-gis-analytics/.worktrees/jp-wave3/docs/handoff/jp-wave2-hazard.md`（analytics worktree `jp-wave3`；欄位定義見同 worktree `docs/data-catalog/world/<dataset_id>.md`、`pipelines/world/<dataset_id>/README.md`）。

## 一句話說明

日本分頁「災害」主題新增 2 個靜態 PMTiles 面圖層：土砂災害警戒區域（1,793,171 面）、內水浸水想定區域（202,357 面）；預設 off。這一批同時把日本分頁改用台灣的主題系統（15 個主題、共用 5 類大分類），所以兩層直接掛在新結構的「災害 › 崩塌 Landslide」「災害 › 淹水 Flooding」。

## 圖層與 runtime 路徑

| layer key | 位置 | PMTiles | 供應 | 型別／色票 SSOT |
|---|---|---|---|---|
| `jpLandslideWarningAreas`（土砂災害警戒區域） | 災害 › 崩塌 Landslide（群組第一個） | `public/world/jp_landslide_warning_areas.pmtiles`，108,187,594 B，z8–12（source maxzoom 12，z13 起 overzoom），SHA-256 前 12 碼 `b85c1008459b` | **S3 deploy-assets/world/**（gitignore，合併 develop 時上傳） | `src/data/jpLandslideWarningTypes.ts` |
| `jpInlandFloodAreas`（內水浸水想定區域） | 災害 › 淹水 Flooding（外水洪水之後） | `public/world/jp_inland_flood_areas.pmtiles`，15,061,714 B，z8–14，SHA-256 前 12 碼 `21eb77d38c59` | git-track | `src/data/jpInlandFloodTypes.ts` |

- hook：`src/hooks/useJp{LandslideWarningAreas,InlandFloodAreas}Layer.ts`；host：`src/layers/hosts/japanHosts.tsx`；popup：`japanPanels.tsx`；圖例：`legend/civicServiceLegends.tsx`。PMTiles URL 帶 `?v=<sha256 前 12 碼>`，上游重產同名檔時要同步更新 hook 內的 `FILE`。
- 兩層都 minzoom 8（低於 z8 沒有磚）。

## 樣式與控制項

- **土砂**：`zone_class` 黃 `#facc15`／紅 `#b91c1c`（災害語意色，spec §3.15–3.16，與台灣崩塌 `DOD_RISK_OPTIONS` 同色系）；單一 fill 圖層用 `fill-sort-key`（紅 1、黃 0）讓紅區疊在黃區上面；面透明度走 `coverage` 階（HOOK_FILL_TIERS）。控制項：透明度、「區域種別」（全部／只看紅／只看黃）、「現象」（全部／急傾斜地崩壞／土石流／地滑り），篩選用 `zone_class`、`phenomenon_en`。
- **內水**：`depth_rank` 1–8 用色盤庫（`gridPalette`，預設 PuBu，8 階由 7 階重新取樣，暗淡兩版），面透明度走 `graded` 階；控制項：色盤、透明度。
- 四鐵則：opacity 滑桿（兩層）、圖例（含語意限制）、popup（`FOOTER_SELF_MANAGED_LAYER_TYPES` 已登記，自掛 SourceFooter）、select（土砂 2 個；內水為色階分級，不需篩選）。

## 資料語意（必保留，圖例與 popup 都有寫）

- **土砂**：紅區在黃區之內，面數與面積不可相加；概略位置（1/25,000–1/50,000），非法定圖書、不涵蓋各縣所有指定區域，不可作為不動產說明或申請根據；「指定前」是基礎調查結果公表、尚未正式指定；令和7年度版（基準 2025-08-01），各縣整備時點不一（最舊群馬 2024-03 底）。**京都府已納入**（上游 2026-10-26 重產），商用利用不可：tile 帶 `license_note`，popup 有值才顯示「授權限制」列，圖例不再寫「京都未涵蓋」。
- **內水**：只涵蓋 22 都道府縣內的 28 個市町村（「未涵蓋」要用 `municipality_code` 判斷，不能用縣）；只有「想定最大規模降雨」一個情境；無資料≠無風險；是內水（雨水出水），與既有 `jpWaterFloodHazard`（外水洪水 raster）是不同的層，不可合併。
- 出典（PDL1.0 要求標註加工）：
  - 土砂：出典：国土数値情報（土砂災害警戒区域データ）（国土交通省）および各都道府県の原典資料を加工して作成
  - 內水：出典：国土数値情報（雨水出水（内水）浸水想定区域データ）（国土交通省）を加工して作成

## 供應與發版

- `public/world/jp_landslide_warning_areas.pmtiles` 已寫進 `.gitignore`（單一檔名）與 `scripts/deploy/upload-deploy-assets.sh` 的 world allowlist；**發版當天（合併 develop 時）先上傳 S3 `deploy-assets/world/`**（已寫進 CHANGELOG）。
- 上游另有 `jp_landslide_warning_areas.full14.pmtiles`（322MB，z8–14），只留本機，不上線。

## 反向連結

analytics handoff：`taipei-gis-analytics/docs/handoff/jp-wave2-hazard.md`。
