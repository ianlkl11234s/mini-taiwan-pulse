> ⚠️ 歷史文件（已被 [PLAN-warehouse-20260926](../../PLAN-warehouse-20260926.md) 取代），只作查證，不作施工依據。

# P2 林道來源與本機同版收據

2026-09-25。本收據證明本機原表、展示 PMTiles 與固定 2D 分析 sidecar 的版本鏈，以及正常配對的單條林道查詢與地圖 readback。點到線距離運算及遠端 release 尚未驗證，P2 的「附近林道」仍為 `HOLD`。

| 項目 | 實讀證據 |
|---|---|
| 來源 | 農業部「林道分布圖」dataset 38213，官網列政府資料開放授權條款第 1 版、不定期更新；此版本的來源觀測日與取得日未有可信 receipt。 |
| 分析原表 | `taipei-gis-analytics/data/processed/forestry/forest_roads/forest_roads.geojson`，SHA-256 `68f26143…1f16`，16,523,601 bytes、107 個 LineString。Pulse `public/forestry/forest_roads.geojson` 與其 SHA 相同。原表 329,885 個 vertex 均有第三個 `Z=0`，分析應明確取前兩維，不能把 0 當海拔。 |
| 展示檔 | 原 checkout `public/forestry/forest_roads.pmtiles`，SHA-256 `68bfbdb3ba55beda943b8dce8189d6e8ac91b6ad2af52f5036d38c3819fd67cc`，1,213,919 bytes。metadata 列 `tippecanoe v2.79.0`，source layer `forest_roads`，107 條，命令為 `tippecanoe -o forest_roads.pmtiles -zg --drop-densest-as-needed --simplification=10 -l forest_roads --force forest_roads.geojson`。 |
| 同版重建 | 在 `/private/tmp/pulse-p2-rebuild` 以 analytics GeoJSON 執行 metadata 原命令，輸出 SHA-256 也是 `68bfbdb3ba55beda943b8dce8189d6e8ac91b6ad2af52f5036d38c3819fd67cc`。這證明上述本機 display bytes 由該 raw bytes 與參數重建；遠端資產尚未實讀。 |
| 分析 sidecar | `public/research/forest-roads/forest-roads-2d.geojson`，SHA-256 `c3d851c7c6bc25d0838c75bb16114f4470848cb4ef0cbfada65030c6a20c8e4b`，13,063,509 bytes。建置器逐一保留 107 條線的 329,885 組經緯度，移除無語意的 `Z=0`；manifest 釘住來源與產物 SHA。3734 `HEAD` 回 `200`、`application/geo+json`、正確長度。 |

獨立 oracle：Python 3 + Shapely 2.1.2 / pyproj 3.7.2，以查詢點為中心的 WGS84 AEQD 投影計算點到**整條線**最近距離，非道路行駛或步行距離。埔里 `[120.965,23.968]` 的卓社林道約 7.673 km；新地點烏來 `[121.55,24.86]` 的內洞林道約 1.013 km、桶后林道約 3.699 km，10 km 內共 2 條；花蓮 `[121.606,23.98]` 最近西林林道約 24.551 km，10 km 內 0 條。這些是本機原表運算，不是產品查詢結果。

配對全鏈：在既有 3734 前端由 Codex 自行完成配對確認，MCP `pulse_describe_dataset(tw-forest-roads-fixed-source)` 回報 107 條固定 LineString、SHA 與 `maxRowsPerQuery=5`；`pulse_query_records` 以 `road_name=桶后林道`、`limit=5` 回 `totalMatched=1`、`result-6b2500940c2aa94021111d36`，source receipt 為 sidecar SHA，首次掃描／下載 13,063,509 bytes。`pulse_present_result` 後 `pulse_wait_scene_ready` 回 revision 2 `ready`；`pulse_get_map_context` 回同一 resultId、featureCount 1、source/layer 各 1 且 ready。正常 IAB 地圖可見青色線形；這只證明單條線呈現，並非「附近有什麼」的距離答案。

待完成：點到完整 LineString 的有界距離 operation、跨 bbox 的完整線搜尋、遠端版本 receipt；目前 descriptor 不支援 bbox，且全源載入 13.1 MB，不能擴成大型線家族。靜態「管制點／備註」欄位不代表即時可通行。
