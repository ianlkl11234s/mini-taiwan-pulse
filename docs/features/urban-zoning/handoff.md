# Handoff — urban-zoning（下游視角）

> **上游 SSOT**：`../../../taipei-gis-analytics/docs/handoff/urban-zoning.md`（詳細契約看那份）
>
> 本檔只放**前端接線的簡表 + 上游約定的差異點**。契約細節不重複寫，只反向引用。

## 上游 handoff 摘要

- 產物：`public/urban/urban_zoning_taipei.pmtiles`（3.4MB / 15,518）+ `urban_zoning_newtaipei.pmtiles`（8.3MB / 34,190），WGS84 MultiPolygon，z6–15，source-layer 名 = 檔名 stem
- 更新頻率：irregular（都計變更後上游重跑 pipeline `--publish`），檔案整檔替換、前端無需改碼
- 資產管理：**gitignored 走 S3**（`public/urban/*.pmtiles` 既有規則；upload/pull/nginx 已全數登記，本次零 deploy 變更）
- 授權：OGDL-Taiwan-1.0（北市 data.taipei 2026-04-01 / 新北 opendata 2026-02-26）

## 前端接線位置

- 色票 SSOT：`src/data/urbanZoningTypes.ts`
- Overlay：`src/map/overlayRegistry.ts`（pmtiles fill + line，篩選 filter 函式，`rebuildOnParamChange: ["fill","line"]`）
- UI toggle：`layerCatalog.ts`（底圖 Base Map > 土地使用分區 Zoning）
- Popup：`urbanPanels.tsx` UrbanZoningPanel（兩 key 共用）

## 硬依賴欄位（改一定爆）

- `zone_category`（9 值統一分類）— match 分色 + 分類篩選 + 圖例
- `zone_name` / `zone_raw` — popup 標題 fallback 鏈（北市用 zone_name；**新北 zone_name/zone_short 全空，靠 zone_raw**）；`"nan"`/`"null"` 字面字串視為缺值
- 北市 4 筆範圍框 meta-polygon（zone_raw=`"nan"`）已用 filter 濾除（渲染+點擊都排除），上游 UZ-5 清資料前不可移除此 filter
- `zone_short` / `zone_code` / `city` / `plan_level` — popup rows
- source-layer 名 `urban_zoning_taipei` / `urban_zoning_newtaipei` — overlayRegistry pmtiles.sourceLayer

## 上游改動 → 下游要跟改的觸發點

- 新增縣市 → 新 pmtiles + 新 key（同構複製 entry），色票/圖例/panel 全部共用不用改
- `zone_category` 增減值 → `urbanZoningTypes.ts` 色票表 + 圖例自動跟隨（讀表渲染）
- 新北 TLS 憑證問題屬上游 fetch 層，下游無感

---

## 非都市土地使用分區（2026-08-02 加入）

> 上游 SSOT：`taipei-gis-analytics/docs/handoff/pulse-batch-20260801.md` §2 B

- 產物：`public/urban/non_urban_zoning.pmtiles`（37.5MB / 68,220 面，z5–14，source-layer 名 `non_urban_zoning`）
- 覆蓋：18 縣市。**臺北市・嘉義市無資料是正常的**（全境都市計畫區）；金門・連江上游未收
- 更新頻率：yearly（資料時點 112 年 / 2023）
- 資產管理：同都計兩層，gitignored 走 S3（`public/urban/*.pmtiles` 既有規則涵蓋，零 deploy 變更）

### 硬依賴欄位

| 欄位 | 用途 |
|---|---|
| `zone_code` | **11 碼分色 + 篩選 + 圖例的唯一依據**（AA/AB/AC/AD/AE/AF/AG/AH/AJ/AK/AL） |
| `zone_name` | popup 標題 |
| `county` / `town` | popup rows |
| source-layer 名 `non_urban_zoning` | overlayRegistry `pmtiles.sourceLayer` |

### 與都計分區的差異點

1. **上色欄不同**：都計用 `zone_category`（9 值），非都市用 `zone_code`（11 碼）。
   刻意不用非都市的 `zone_category`（10 值）——AA 特定農業區 / AB 一般農業區 會被併成
   同一個 `agricultural`，但兩者在農地變更難易度上差很大，是這份資料最有價值的區別。
2. **預設透明度較低**（0.35 vs 0.5）：本層面積覆蓋全台山區與農地，0.5 疊上去會把底圖糊掉。
3. **popup 不顯示 `zone_category`**：值是英文（`slope_conservation`…）且與 zone_name 資訊重複。
4. **點擊順序**：`useMapInteraction` 中排在兩層都計分區**之後**，免得大面積擋掉都市內的點選。
