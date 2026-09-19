# 日本高度第一批跨區擴展 — 2026-09-18

目前為 LOCAL_ONLY，五個城市的局部 ROI，非全市／全國完成。永久前端與 analytics worktree 都是 `.worktrees/jp-height-layers-20260918`，branch `codex/jp-height-layers-20260918`。本次未 commit、push、發布或部署。

## 交付資料

| 區域 | PLATEAU 年份 | 輪廓數 | 高度缺值 | 幾何 |
|---|---:|---:|---:|---|
| 東京新宿 | 2025 | 13,629 | 407 | RoofEdge |
| 大阪 | 2025 | 10,615 | 600 | FootPrint |
| 札幌 | 2020 | 6,974 | 88 | RoofEdge |
| 福岡 | 2024 | 11,041 | 0 | 依 feature geometry_method |
| 那霸 | 2020 | 14,881 | 55 | 依 feature geometry_method |

五區均有 CHMv2 樹冠 raster，19.109m EPSG:3857 pixel（地面解析度隨緯度變動），2026 是 release year，不是共同觀測日。nodata 不當作零。建物新分片只留 geometry、height、source_id、geometry_method；年份／授權／來源由 catalog 在點擊時補入。

Catalog 所引用 16 個 PMTiles 合計 20,958,214 bytes；共用 overview 56,018 bytes，659 個格網 feature（不同尺度不能互相加總），最大 compressed tile 3,105 bytes。overview 僅合併各 ROI 已有統計並加 region_id，沒有跨城市重算或假設全格覆蓋。

## 資源限制與語意

- 遠距 z4–12：單一共用 overview；近距 z13+：最多4個建物分片；樹冠最多2個分片，合計最多6個 source。
- 只選與 viewport 相交的實際 artifact bbox，近中心優先；離開範圍先移除 layer/source 與 paint/layout snapshot，再加入新分片。moveend debounce 200ms。
- 切換 style／關圖層／卸載 map 會取消 catalog request、清 loading task 與計時器。載入逾時30秒／錯誤在圖例可見。
- Probe 僅保留2個 JP archive，取消較舊查值請求。PMTiles Range 載入；source cap 不等於已量測的 heap/GPU 硬上限。
- mapbox-pmtiles roundZoom 在 z12.5 會以 z13 建 bucket；動態 grid layer 不設定 maxzoom，由 controller 在 z13 卸載，避免半級縮放空白。
- 安裝器每 detail/canopy≤25MB、grid≤5MB、整批≤150MB；先查 bytes/SHA，使用 SHA 檔名、原子安裝 payload，最後原子換 catalog。既有 payload 不刪除。
- 上游 raw 第一批1,264,740,864 bytes；campaign cap3GB、單城raw1GB、保留磁碟15GiB。樹冠新增四區讀取COGoverview Range，未下載完整原始COG；未宣稱驗證原始物件全檔SHA。

## 本地重現

先在 analytics worktree 執行 `python3 pipelines/jp_heights/national_buildings.py --help`，依上游 `docs/handoff/jp-height-national-buildings.md` 使用 checkpoint。共用格網：

```sh
python3 pipelines/jp_heights/national_overview.py
```

前端安裝已驗證產物：

```sh
python3 scripts/preprocess/install-jp-height-national.py --analytics-root '/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/.worktrees/jp-height-layers-20260918'
npm run dev -- --host 127.0.0.1 --port 3746 --strictPort
```

## 驗收與後續

資料：四城建物 detail/grid 的 PMTiles verify、各尺度 count/valid/missing 守恆、21個 upstream建物／格網測試通過；canopy4tests、四城RGBA/mask/SHA/PMTiles QA通過；overview逐feature保留與LODdecode通過。

前端：catalog/lifecycle/type/manifest/golden/hook 等 focused 50 tests 通過；另以實際瀏覽器確認大阪輪廓與209.4m popup、250m格網及大阪2025來源。最終 build 與其他browser證據見 acceptance.md。

全國官方清冊包含307筆CityGML來源紀錄；上游 `data/jp-heights/national/plateau-national-inventory.json` 將 source_available 與 processed=false 分開。這不是307個城市已完成。

下一批必須按 city/mesh 估計 raw、輸出與磁碟預算，分批取得與驗證，不可一次抓全日本。既有 runner 的城市中心 ROI 不代表全市範圍；要鋪滿都市需先依正式市界／mesh 分片，建立覆蓋 ledger、去重與跨片統計規則，再逐片接入。全國長時間 heap/GPU、手機實機與最密集區壓测未完成。

PROD sidebar gate 仍關閉；現有 upload/pull 腳本只認 pilot 六檔，尚不發布新 catalog。發布須另做 exact catalog asset allowlist／Range驗證／production驗收。Embed 仍使用 pilot registry，未接全國 lifecycle。
