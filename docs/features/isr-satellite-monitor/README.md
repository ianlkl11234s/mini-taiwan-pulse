# 中國 ISR 衛星領海過境監測

> **Slug**：`isr-satellite-monitor`
> **狀態**：production
> **Owner**：Mini Taiwan Pulse
> **上線日期**：2026-08-30
> **相關 PR**：#185

## 一句話說明

在 Monitor 以每日直條呈現公開目錄中中國 ISR-capable 候選衛星的星下點穿越臺灣本島 12 浬領海範圍次數，並在 tooltip 顯示當日不重複衛星數。

## 元件

| 名稱 | 類型 | 資料源 | 狀態 |
|---|---|---|---|
| 中國 ISR 衛星領海過境 | Monitor card | `public.get_isr_satellite_passes_daily` RPC | ✅ production verified |

## 關鍵檔案

- Loader：`src/data/isrSatellitePassesLoader.ts`
- Card：`src/components/intel/monitor/IsrSatellitePassCard.tsx`
- Dock 佈局：`src/components/intel/monitor/monitorLayout.ts`
- Split 佈局：`src/components/intel/monitor/monitorSplitLayout.ts`

本功能不是地圖圖層，不建立 `layerManifest` entry。

## 指標語意

- 主柱：`pass_count`，同一顆衛星同日多次穿越會計多次。
- Tooltip／副值：`unique_satellite_count`，當日 distinct 衛星數。
- v1 固定標示為 `YAOGAN / GAOFEN / JILIN` 三家族範圍，不宣稱全中國 ISR census。
- `scope_coverage_complete=true` 且 count 明確為 `0`，才顯示 v1 scope 內的真零；`china_isr_census_complete=false` 不會擋住三家族範圍內的有效計數。
- 缺日、null、stale 或 RPC error 都不補 0；`coverage_complete=false` 仍可呈現已計得的 partial registry 數字與範圍警示。
- 圖表只呈現 `target_day <= latest_valid_day` 的完整日；較新的未完成列不進圖。
- 星下點穿越只代表公開軌道推算，不代表 payload 開機、指向臺灣或實際蒐情。

## 資料契約摘要

看 [handoff.md](./handoff.md)。上游 SSOT 預定為 [taipei-gis-analytics handoff](../../../../taipei-gis-analytics/docs/handoff/isr-satellite-monitor.md)。

## 相關文件

- [Backlog](./backlog.md)
- [Changelog](./changelog.md)
- [開發規則](../../development-rules.md)
