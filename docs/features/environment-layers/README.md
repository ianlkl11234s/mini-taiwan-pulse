# 環境氣候一般圖層（第二波）

更新：2026-10-02。在 #490 的水質與污水 4 層之後，再接 9 層：5 個靜態 GeoJSON（隨 dist）＋4 個即時 public RPC。第一波 4 層的說明仍在 [environment-statistics](../environment-statistics/README.md)。

## 圖層

| key | 名稱 | 來源／runtime | 著色 | 更新頻率 | sidebar（環境氣候 Environment →） |
|---|---|---|---|---|---|
| `seaWaterQualityStations` | 海域水質測站 | `public/environment/sea_water_quality_stations.geojson`（250） | 甲乙丙海域環境分類（GnBu）；過期／無採樣中空灰 | 約每季 | 水質與污水 |
| `riverRpiSegmentsTamsui` | RPI 河段（試作・推估） | `public/environment/river_rpi_segments_tamsui_trial.geojson`（38 LineString） | RPI 四級（與 riverRpiStations 同色）；select 切最新一次／近 12 月平均；已確認感潮段虛線 | 隨 RPI 測站（月） | 水質與污水 |
| `waterEffluentLive` | 放流水連線監測 | RPC `get_water_effluent_latest(p_stale_hours=3)` | 逾時灰 > 超限紅 > 異常黃 > 正常青 | 每小時（輪詢 1 小時） | 水質與污水 |
| `pm25ManualStations` | PM2.5 手動採樣站 | `public/environment/pm25_manual_stations.geojson`（45） | 近 12 月平均漸層（與微型感測 PM2.5 五級同源）；停測／無樣本中空灰 | 約每 3 天採樣 | 空品 |
| `dioxinStations` | 環境空氣戴奧辛測站 | `public/environment/dioxin_stations.geojson`（33） | 最新 pg I-TEQ/m3 漸層（BuPu）；過期中空灰 | 約半年 | 空品 |
| `incineratorEmissions` | 焚化廠空污監測 | `public/environment/incinerator_emissions.geojson`（25） | NOx ppm 漸層（YlOrBr） | 月 | 環境污染 |
| `cemsStackLive` | 煙道 CEMS 連線監測 | RPC `get_cems_stack_latest(p_stale_hours=6, p_include_items=true)` | 逾限紅／運轉／起停車／歲修／暫停停工；逾時或狀態未提供中空灰 | 每小時，上游延遲 4–5 小時（輪詢 1 小時） | 環境污染 |
| `nuscGammaRadiation` | 環境輻射（核安會） | RPC `get_nusc_gamma_latest(p_stale_minutes=30)` | μSv/h 漸層（Purples，≠ 台電周界的綠）；≥0.2 紅框；逾時中空灰 | 15 分鐘（輪詢 15 分鐘） | 環境污染 |
| `cwaUvDaily` | 紫外線（前一天最大值） | RPC `get_cwa_uv_latest(p_stale_days=2)` | 五級（與 PM2.5 五級同色序）；缺值／逾時中空灰 | 每日（6 小時重抓） | 氣象 |

## 設計決策

- **焚化廠用 NOx 著色**：25 廠皆有值、分布 26–86 ppm；戴奧辛被高雄南區 0.592 ng-TEQ/Nm3 單點拉開，其餘 24 廠會擠成同色。戴奧辛（各爐＋最大值）照實列 popup，不裁切。資料集未附排放標準，legend／popup 明寫「不判定超標」，色階不用綠→紅。
- **CEMS 狀態**：地圖請求帶 `p_include_items=true`（約 1 MB／小時），loader 依各測項 code2 首碼算設施狀態後丟掉 items，不進 feature properties；逾限只認上游 `is_exceed`（code2desc「數值逾限」）。popup 點開再用 `p_cno` 拉全部測項。
- **即時 4 層是「當下快照」**：不接 timeStore、不跟時間軸（同 erHospital／核安 LIVE），所以不違反 development-rules §8。RPC 失敗：清空 source、圖例顯示「資料服務回應失敗」、右上載入條記失敗，不留舊資料。座標 NULL 不畫，筆數在圖例揭露。
- **A2 疊放**：registry 順序＝z 序，`riverRpiStations` 移到 `waterQualityStations` 之後；水質測站切類型會 remove/addLayer 到最上層，故 RPI 的 `rebuildOnParamKeys` 也監聽 `waterQualityStationsTypeIdx`，跟著重建回到上方（瀏覽器實測 index 610 > 609）。
- **A1**：自來水不合格二元圖例不再顯示「淺 → 深：數值低 → 高」。
- 色彩：全部取自既有色票（`statisticsVisuals` 序列色經 `STATISTICS_SEQUENTIAL_SCHEMES` 匯出、`MICRO_SENSOR_PM25_BANDS`、本檔 RPI／水質色），SSOT 在 `src/data/environmentLayerTypes.ts`；元件內無新 hex，designSystemGuard 無新增。

## 驗收（本地，2026-10-02）

- `npx tsc -b` 綠；`npm run build` 成功；`npm test` 全套在高負載下有 20 個檔案逾時，單獨重跑 20/20 綠（99 tests）；新增 `environmentWave2Contract.test.ts`（11）。
- layer-golden：864 keys（+9），既有層內容零 diff；`overlays` 陣列只有 `riverRpiStations`／`waterQualityStations` 兩筆互換位置（A2 刻意）。
- 瀏覽器：見 [changelog](./changelog.md)。
