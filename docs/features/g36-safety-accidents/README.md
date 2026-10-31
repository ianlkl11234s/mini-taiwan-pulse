# G36 消防、民防與交通事故（g36-safety-accidents）

> **狀態**：本機完成（2026-10-31，分支 `feat/tw-g36-safety-accidents`，PR 到 develop，未合併）。候選文件 `.gis-agent-system/roadmap/candidates/G36-fire-civil-defense-traffic-accidents.md`。

## 一句話說明

新增 2025 年 A1／A2 交通事故點位、救災資源據點、海嘯警報臺、核電廠集結點與收容處所、國軍與海巡射擊公告區 5 層，並把消防栓擴成全國；執法治安新增「交通事故」群組，既有 4 個事故圖層只改 `section.group`，key 不變。

## 圖層

| Key | 主題 › 群組 | 檔案 | 筆數 | 來源 |
|---|---|---|---|---|
| `trafficAccidents2025` | 執法治安 › 交通事故 | `public/geo/traffic_accidents_2025.pmtiles`（18.9MB，gitignored，發版日上傳 S3） | 321,534（A1 1,361、A2 320,173） | 警政署 A1／A2 類道路交通事故（data.gov.tw 12197；analytics `traffic_accident_by_incident.geojson`，2025-12-03 取得） |
| `fireHydrants`（擴充） | 消防 › 點位 | `public/geo/fire_hydrants_national.pmtiles`（16.0MB，gitignored，發版日上傳 S3） | 211,530 | 北水處 128639＋高市消防局 160481 等＋台水 44642 |
| `disasterResourceSites` | 消防 › 點位 | `public/geo/disaster_resource_sites.geojson`（3.1MB，git-track） | 5,379 | 消防署救災資源（data.gov.tw 77862） |
| `tsunamiSirens` | 民防避難 › 警報與疏散 | `public/hazards/tsunami_sirens.geojson`（149KB） | 376 | data.gov.tw 34102 |
| `nuclearEpzEvacuation` | 民防避難 › 警報與疏散 | `public/hazards/nuclear_epz_evacuation.geojson` | 集結點 182＋收容處所 18 | data.gov.tw 102114＋102434 |
| `firingNoticeAreas` | 情勢 › 軍事 | `public/marine/firing_notice_areas.geojson` | 海軍 94＋海巡 93 | data.gov.tw 136419＋143315 |

產生腳本：`scripts/preprocess/build-g36-safety-public.py`（子指令 accidents／hydrants／tsunami／nuclear／resources／firing；原始下載放 scratchpad，不進 repo）。

## 口徑與限制

- **交通事故**：期間 2025-01-01～2025-11-17（警政署月檔，以事故為單位去重）；**不含 A3（僅財損）**。既有 `trafficAccidentYearly` 的 114 年 A1 為 1,600 件，取自另一份全年 A1 檔（data.gov.tw 177136，涵蓋 11/18 之後），兩者件數不可直接比較，圖例已寫明。2 筆座標落在臺灣外（123,22）（121,21）已剔除。
- **消防栓**：舊來源（北水處、高市消防局）原有 69,839 點；台水 141,691 點補其他縣市。台水高雄 24,092 點與高市消防局資料重疊（約 2/3 在 15 m 內），整批不採用；新北台水與北水處供水區互補（只有 7 點在 15 m 內，剔除），臺南 1 點同理。7 筆完全重複列刪除。台水「型式代碼」0–5 無公開對照表，另立「台水（型式代碼未公開）」分類並在 popup 顯示原碼。舊檔 county_id A 其實含新北 8,568 點，已用縣市界空間連結改正。
- **救災資源據點**：189 筆座標為 0、無效或在國外而未上圖；保管單位依名稱關鍵字粗分（消防／公所／警察／衛生醫療／其他），不是來源欄位。
- **海嘯警報臺**：1 筆（新北 興仁派出所）無座標未上圖。
- **核電廠收容處所**：102434 有 30 組「村里→各旅宿／民宿」泛稱，沒有可定位地址，未上圖（恆春 15 個村里）。
- **射擊公告區**：全部是過去的公告（不是即時禁區），popup 標示；電話欄位含個人手機，前處理已刪除。

## 四鐵則

每層都有 opacity／大小滑桿、圖例（`src/components/legend/g36SafetyLegends.tsx`）、popup（`src/components/featureInfo/g36SafetyPanels.tsx`、消防栓沿用 `FireHydrantPanel`）、select（多選篩選：事故嚴重度與肇因、集結點／收容處所、保管單位、公告機關）。色票 SSOT：`src/data/safetyG36Types.ts`。

## 未做

- 地質敏感區（27744）：RAR 壓縮的 shapefile，依指示預設略過。
- 海岸極端暴潮溢淹線（158145）：GeoTIFF 網格，需另做向量化或 raster tiles，略過。

## 待上游／待拍板

- pulse-data registry 尚無這 5 層與台水消防栓的條目（本 PR 不可改 registry）。
- analytics catalog：`traffic_accident` 的 `used_by_pulse_layers` 待補 `trafficAccidents2025`；消防栓 catalog 待補 44642 台水來源。
