# Handoff — 日本氣象廳即時圖層（下游視角）

> **上游 SSOT**：data-collectors JMA collector（C1–C3）＋ gis-platform migration 435；規劃見
> `../../../taipei-gis-analytics/docs/topic-research/japan_opendata/jma-collectors-plan.md`、`docs/api-platforms/jma/`。

## 上游摘要

- 讀取：Supabase PostgREST public view（anon SELECT），前端不直打 `live.*`
- 時間：timestamptz（來源 JST）；前端一律以 `Asia/Tokyo` 顯示並標 JST
- 缺值：NULL（不補 0）

## 硬依賴欄位（改一定爆）

- AMeDAS：`lat` `lon` `observed_at` `temp` `precip1h` `snow` `wind` `has_snow_gauge`（popup 另讀 precip10m/3h/24h、wind_dir、gust、humidity、pressure、sun1h、snow1h–24h、alt_m、station_name(_en)）
- 警報：`area_code`（class20＝7 碼，前 5 碼對 PMTiles `admin_code`）`area_level` `area_name` `kind_name` `status` `control_datetime` `report_datetime` `office_name`
- 地震：`report_time`（時間窗與排序）`lat` `lon` `magnitude` `max_intensity` `origin_time` `depth_km` `hypocenter_name` `title` `event_id` `intensity_by_pref`
- 火山：`lat` `lon` `level_name`（解析「レベルN」，含全形）`level_code`（11–15 備援）`warning_kind` `report_time`

## 對應規則

- 警報嚴重度只從 `kind_name` 判（特別警報 > 危険警報 > 警報 > 注意報；名稱缺 → 種類未對照）。`status` 為「解除」「発表警報・注意報はなし」不上色。
- 政令市分區（如横浜市北部 1410011／南部 1410012）在界線裡是各「區」→ 用「縣碼 2 碼＋city_name」整市著色。
- class10 等非市町村層級列不上色，列在圖例「未上色區域」。
- 2026-10-09 實測：class20 664 個區域對 `jp_admin_boundaries.pmtiles` 全數對上（0 未對應）。

## 上游改動 → 下游要跟改

| 上游改動 | 下游動作 |
|---|---|
| kind_name 改用新名稱體系 | 檢查 `jmaWarningLevel()` 關鍵字 |
| 增加非 class20 層級 | 目前進「未上色」清單；需要上色時另接界線 |
| quake view 改永久無窗 | loader 已帶 `report_time >= now-7d` |
