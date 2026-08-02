# Handoff — 登山安全 Mountain Safety（下游視角）

> **上游 SSOT**：`../../../taipei-gis-analytics/docs/handoff/pulse-batch-20260801.md`（§2 A / A2）
>
> 本檔只放前端接線簡表 + 與上游約定的差異點。

## 上游 handoff 摘要

| 項 | 山域事故 | 山屋 |
|---|---|---|
| 上游 dataset | `hazards.mountain_rescue_incidents` | `forestry.mountain_huts` |
| 上游成品 | `data/processed/hazards/mountain_rescue_incidents/mountain_rescue_incidents_20260801.geojson` | `data/processed/forestry/mountain_huts/mountain_huts_20260801.geojson` |
| pulse 路徑 | `public/hazards/mountain_rescue_incidents.geojson`（2.1 MB，進 git） | `public/forestry/mountain_huts.geojson`（120 KB，進 git） |
| 量級 | 2,465 point（2019-2024） | 136 point |
| 更新頻率 | 年度（消防署年報） | 不定期（OSM 變動時） |
| 座標系統 | WGS84 | WGS84 |
| 授權 | 政府開放資料 | **含 OSM → ODbL，圖面必須標示** |

（完整契約 → 上游 handoff）

## 前端接線位置

- Loader：**無**（靜態 GeoJSON 直接走 `overlayRegistry.sourceUrl`，不經 Supabase）
- Overlay：`src/map/overlayRegistry.ts`
- 分類 / 配色 SSOT：`src/data/mountainSafetyTypes.ts`
- UI toggle：`src/components/sidebar/layerCatalog.ts`（LAYER_COLORS + THEMES）
- 部署：`nginx.conf` `location /hazards/` + pull/upload 腳本

## 硬依賴欄位（改一定爆）

### mountainRescueIncidents

| 欄位 | 用途 |
|---|---|
| `cause` | 9 族分色 + 圖例 + popup 標題（原始值清單寫死在 `MOUNTAIN_RESCUE_CAUSES[].raw`） |
| `year` | 年份 dropdown 篩選（值為 **number** 不是 string） |
| `deaths` | >0 → 紅描邊 |
| `fire_local_persons` / `fire_support_persons` / `police_persons` / `npark_persons` / `forestry_persons` / `civilian_persons` | 加總 → 點大小 4 級 |
| `case_id` / `city` / `mountain_area` / `reported_at` / `closed_at` / `rescued` / `missing` | popup |

### mountainHuts

| 欄位 | 用途 |
|---|---|
| `facility_type` | 4 類分色 + 圖例（`hut` / `lodge` / `campsite` / `shelter`） |
| `name` | popup 標題（**可為 null**，前端顯示「無名山屋」） |
| `ele` / `capacity` / `name_en` / `managed_by` / `operator` / `in_yushan_official` | popup（皆為選填） |

## 上游改動 → 下游要跟改的觸發點

| 上游改動 | 下游動作 |
|---|---|
| `cause` 出現新的原始值 | 補進 `MOUNTAIN_RESCUE_CAUSES[].raw`，否則新值靜默落到「其他・不明」灰色 |
| 事故資料延伸到 2025+ | `MOUNTAIN_RESCUE_YEARS` 加年份（dropdown 與 filter 都吃這個常數） |
| `facility_type` 新增第 5 類 | `MOUNTAIN_HUT_TYPES` 補一行，否則落中性灰 |
| 山屋改走 Supabase | 要補 loader + loadingRegistry（現在沒有 loader = 沒有 loading UI 需求） |
| 檔案漲過 ~10 MB | 改走 S3 deploy-assets（`.gitignore` + upload 腳本；nginx / pull 已就緒） |

## 已知不對稱

1. **上游 handoff 說「10 個出動人次 int 欄」**，實際是 **6 個人次欄 + 4 個架次/次數欄**
   （直升機 2 / 搜救犬 / 無人機）。前端只把 6 個人次欄加總成點大小，架次分開列在 popup。
2. 上游建議山域事故「可接時序回放」，下游**刻意不接**全域時間軸（語意是即時軸），改用年份 filter。
3. 上游 CSV 原始檔 X/Y 欄名對調（X=緯度），pipeline 已修，成品座標正確——若有人回頭碰 raw 要知道。
