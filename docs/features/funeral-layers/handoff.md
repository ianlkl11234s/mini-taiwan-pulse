# Handoff — 殯葬 Funeral（下游視角）

> **上游 SSOT**：[`../../../taipei-gis-analytics/docs/handoff/funeral-layers.md`](../../../taipei-gis-analytics/docs/handoff/funeral-layers.md)
> 本檔是該契約的**下游反向引用**：記下 pulse 這端實際怎麼接、哪些欄位是硬依賴、上游改什麼會炸。

## 上游產物 → pulse 路徑

| 上游 dataset（catalog id） | pulse 路徑 | 大小 | git |
|---|---|--:|---|
| `funeral_facilities_moi` | `public/funeral/funeral_facilities.geojson` | 1.24 MB | ✅ |
| `funeral_operators_biz` | `public/funeral/funeral_operators.geojson` | 2.09 MB | ✅ |
| `funeral_operators_district` | `public/funeral/funeral_operators_density.json` | 5.1 KB | ✅ |
| `cemetery_osm` | `public/funeral/cemetery_osm.pmtiles`（layer 名 `cemetery_osm`，z6-14） | 1.86 MB | ✅ |
| `cemetery_zoning_urban` | `public/funeral/cemetery_zoning.geojson` | 0.57 MB | ✅ |

- 更新頻率：商工登記（業者）**每月**；其餘不定期／年度重取
- 座標系統：WGS84（EPSG:4326），已驗證 lon 118.24–122.00 / lat 22.00–26.38（含金馬澎）
- **不走 Supabase**：`gis-platform/migrations/335_funeral.sql`（6 表）**尚未 apply**，
  且前端不依賴。335 是 SSOT 用途，之後要做跨主題 SQL 分析（殯葬 × 高齡人口）才需要。
- **重生指令**（上游）：`./venv/bin/python3 pipelines/funeral/_shared/build_web_assets.py --deploy`

## 硬依賴欄位（改一定爆）

| 欄位 | 層 | 用途 |
|---|---|---|
| `facility_uid` | facilities | 前端 key（上游保證跨批次穩定） |
| `facility_type` | facilities | **6 類分色 + 類型 filter 的唯一依據**（值：cemetery / columbarium / eco_burial / funeral_home / crematorium / ritual_hall） |
| `precision` | facilities / operators | **概略座標警示 + 精度 filter**；`parcel_centroid` / `approximate` 視為概略 |
| `operator_id` | operators | filter 的 `["has", ...]` 全量判斷用 |
| `entity_type` | operators | 2 類分色（`business` / `company`） |
| **`is_active`** | operators | **boolean**，預設 filter `== true`。⚠️ 型別若漂成字串（`"true"`），`== true` 全不成立 → **整層空白**。⚠️ 值本身是**上游規則的函數**（2026-08-06 起「遷他縣市」判為 false），改規則要同步改 UI label |
| `zone_label` | cemetery_zoning | 3 群分色（raw 9 種中文值，見 `CEMETERY_ZONING_CLASSES[].raw`） |
| `area_ha` | cemetery_zoning / cemetery_osm | popup 面積（**number**） |
| `osm_id` | cemetery_osm | popup 標題兜底（65.5% 無 name） |
| source-layer 名 `cemetery_osm` | cemetery_osm | overlayRegistry `pmtiles.sourceLayer` |
| `join_key` = `"TOWNCODE"` | density.json | hook 開場 assert，不符直接中止 join（不靜默畫錯） |
| `TOWNCODE`（8 碼字串） | `base_map/township_boundary.pmtiles` | density 的 `promoteId` + feature-state id |

前三項 + `is_active` + `zone_label` 已被 `staticDataContract.test.ts` /
`classificationCoverage.test.ts` 兩支 ratchet 守住，漂移會 CI 紅燈。

## 上游改動 → 下游要跟改的觸發點

| 上游改動 | 下游動作 |
|---|---|
| `facility_type` 新增值 | `classificationCoverage` 測試會紅 → 補 `funeralTypes.ts` 的 `FUNERAL_FACILITY_TYPES`，否則該批點靜默落中性灰 |
| `zone_label` 新增用地名稱 | 同上 → 補 `CEMETERY_ZONING_CLASSES[].raw` |
| `precision` 新增段位 | 補 `FUNERAL_PRECISION_LABELS`；若屬「概略」還要加進 `FUNERAL_APPROX_PRECISIONS` |
| `is_active` 改型別 | **立刻爆**（整層空白）→ 契約測試會擋 |
| **`is_active` 改判定規則**（哪些 status 算失效） | ⚠️ **測試擋不到** —— 換檔後要手動同步 9 處寫死數字：`funeralTypes.ts` 的 `OPERATOR_STATUS_MODES` label + 檔頭註解、`types/index.ts`、`LegendPanel`、`layerCatalog` labelMobile、`funeralPanels`、`overlayRegistry`、`useTransportParams` ×2、`upstreamRegistry`。2026-08-06 首次踩到（「遷他縣市」26 筆由 active 改判失效） |
| 業者總筆數變動（新增/移除登記） | 同上一列 —— 三個 label 的括號數字都要跟 |
| 密度 `join_key` 換掉 | hook 印 warn 並中止 join（面全落最淺色），需改 `useFuneralDensityLayer` |
| `township_boundary.pmtiles` 換 key 或重切 | density join 全失效 → 同步改 `SOURCE_LAYER` / `promoteId` |
| 無座標尾巴 geocode 回填（438 筆） | 點數變多，前端無需改碼（重新複製檔案即可） |
| C 源擴充到其他縣市 | 無需改碼；圖例那句「僅臺北 12 ＋新北 102 面」要更新數字 |
| 335 migration apply | 下游不受影響（沒走 DB） |

## 已知不對稱（上游文件 vs 實際產物）

1. **上游 handoff §3.1 的 facility_type 分佈是母體數字**（cemetery 3,344 / columbarium 626 /
   eco_burial 69），實際已定位的 3,707 筆是 **cemetery 2,928 / columbarium 607 / eco_burial 66 /
   funeral_home 64 / crematorium 41 / ritual_hall 1**。前端 UI 用後者（實測值）。
2. **`eco_type` 實際只有 樹葬(64) / 植存(2)**，上游文件寫「樹葬/花葬/植存/海葬」—— 花葬與海葬
   在已定位資料裡是 0 筆。前端不硬編這四種，直接顯示原始值。
3. **`operator_type` 只有 public(3,461) / private(246)**，沒有文件提到的 `unknown`。
4. **上游 §3.4 說 `amenity` 是 `cemetery`/`grave_yard`**，切片 tilestats 顯示 `amenity` 只有
   `grave_yard` 一種，`cemetery` 是落在 `landuse`（另有 construction/farmland/farmyard/forest/orchard
   共 6 值）。popup 用 `landuse || amenity` 兜。
5. **業者 `precision` 沒有 `source` 段位**（只有 exact/tgos/cached/interpolated/approximate），
   與設施不同 —— 但 `FUNERAL_PRECISION_LABELS` 是共用表，多列無害。
