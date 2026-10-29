# 急救責任醫院分級（emergency-hospitals）

> **狀態**：本機完成（2026-10-29，分支 `feat/emergency-hospitals`，PR 到 develop）。G30 候選 C(1)。

## 一句話說明

醫療 › 點位新增 `emergencyHospitals`：全國 252 家急救責任醫院依分級上色；預設 off。

## 資料

| 項目 | 內容 |
|---|---|
| 檔案 | `public/geo/emergency_hospitals.geojson`（131KB，git-track）；契約 URL 不可任意搬 |
| 來源 | Supabase `safety.emergency_hospitals`（analytics `docs/data-catalog/emergency_response/hospitals.md`，dataset_id `hospitals`） |
| 授權 | OGDL-Taiwan-1.0 / 政府資料開放授權條款（縣市開放資料 13 份 + 衛福部公告名冊） |
| 快照 | 資料庫 `imported_at` 2026-05-16（上游最後執行 2026-05-16）；來源 PDF 為衛福部 110.6.28 名冊 + 114 年度評定 |
| 座標 | Google Geocoding 地址轉換（離島有 bbox 驗證） |
| 產生 | `scripts/export/export_emergency_hospitals.py`（檔頭有唯讀 SELECT） |

分級分布（252）：重度級 58、中度級 79、一般級 86、未標分級 29（11.5%）。匯出欄位只有院所公開資訊：醫院代碼、名稱、縣市、分級、地址、院所總機；不含 `note`（自由文字）、`has_*` 旗標、承辦人資料。

## 口徑與限制

- 分級為空 → `level_group=unrated`，畫灰色、popup 寫「未標分級」；**不當成一般級，也不代表非急救責任醫院**。
- 刻意不用 `has_emergency_room`、`has_trauma_center`、`has_stroke_center`：前者在 138 家為 false（縣市資料集沒有該欄、預設值被當成 false），後兩者只有高雄資料較完整，皆不可靠。
- 分級來源混合（縣市資料集的分級欄、衛福部 PDF），同一家醫院各來源的分級可能不同，這裡取資料庫現值。
- 部分列是分院或院區（例如「國立臺灣大學醫學院附設醫院新竹臺大分院新竹醫院」），一列一個院所代碼，不等於全國急救責任醫院「家數」的官方統計。
- 座標是地址轉換，不是醫院出入口；約 8 筆與其他點座標重複（同址）。

## 色票與型別

`src/data/emergencyHospitalTypes.ts`：三級序列 indigo，暗／淡底圖方向相反（F-3），未標分級灰 `#6b7280`；不用紅橙黃綠（K-3，等級不是危險程度）。

## 四鐵則

opacity／大小滑桿（`emergencyHospitalsOpacity`／`emergencyHospitalsScale`）、圖例（`EmergencyHospitalLegend`）、popup（`EmergencyHospitalLevelPanel`，layerType `emergencyHospitalLevel`）、select（點選圖層 `emergency-hospitals-circle`）。

## 未解事項

- 資料為 2026-05 快照，上游 `lifecycle: yearly`；analytics catalog 的 `used_by_pulse_layers` 仍是空陣列，待補。
- 若要在 Agent 分析（L2）使用，需在 pulse-data registry 補 `semantics`（現為 `warehouse_stub`，倉庫表 `ds_emergency_response_hospitals` 疊了三個來源檔，count(*)=380，不可直接用）。
