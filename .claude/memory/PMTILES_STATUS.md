# PMTiles 過夜批次轉換 — STATUS

**Plan**：`/Users/migu/.claude/plans/pmtiles-overnight.md`
**啟動時間**：2026-06-25 23:59
**結束時間**：（campaign 完成時填入）
**Branch**：`perf/pmtiles-batch`

## 進度總覽

- 候選總數：13
- 完成：0
- 失敗 / 跳過：0
- 待跑：13

## 任務清單

| # | 檔 | 大小 | 類型 | 路徑 | sourceLayer | 狀態 | 結果 | Commit |
|---|---|---:|---|---|---|---|---|---|
| T1  | provincial_road             | 44 MB  | line    | public/geo/         | provincial_road      | ✅ done | 9.3MB / 21% | 2e12f66 |
| T2  | farm_roads                  | 33 MB  | line    | public/agriculture/ | farm_roads           | ✅ done | 2.7MB / 8% | 41b237b |
| T3  | hiking_trails               | 20 MB  | line    | public/forestry/    | hiking_trails        | ⏳ pending | — | — |
| T4  | national_highway            | 7.9 MB | line    | public/geo/         | national_highway     | ⏳ pending | — | — |
| T5  | medical_clinics             | 26 MB  | point   | public/geo/         | medical_clinics      | ⏳ pending | — | — |
| T6  | medical_ltc                 | 17 MB  | point   | public/geo/         | medical_ltc          | ⏳ pending | — | — |
| T7  | medical_aed                 | 9.4 MB | point   | public/geo/         | medical_aed          | ⏳ pending | — | — |
| T8  | medical_pharmacies          | 8.4 MB | point   | public/geo/         | medical_pharmacies   | ⏳ pending | — | — |
| T9  | fire_hydrants               | 13 MB  | point   | public/geo/         | fire_hydrants        | ⏳ pending | — | — |
| T10 | agri_retail_companies       | 20 MB  | point   | public/agriculture/ | agri_retail          | ⏳ pending | — | — |
| T11 | produce_wholesale_companies | 13 MB  | point   | public/agriculture/ | produce_wholesale    | ⏳ pending | — | — |
| T12 | eco_network_zones           | 9.2 MB | polygon | public/agriculture/ | eco_network_zones    | ⏳ pending | — | — |
| T13 | bus_stations_city           | 19 MB  | point   | public/geo/         | bus_stations_city    | ⏳ pending | — | — |

**狀態圖示**：⏳ pending · 🟡 in-progress · ✅ done · ❌ blocked · ⏭ skipped

## 收尾步驟

- [ ] A. 更新 `scripts/deploy/upload-deploy-assets.sh` 加 PMTiles glob（geo / agriculture / forestry 三目錄）
- [ ] B. 更新 `.claude/memory/BACKLOG.md` PT-1 標 ✅ done + 列 commit hashes
- [ ] C. 本檔寫「campaign 完成」段：總壓縮比 / commit hashes / 待 push 提醒

## ⚠️ 早晨人工待辦（campaign 結束後）

詳見 plan 的「早晨人工 review SOP」。重點 3 件**機器不做**：
1. browser 視覺驗證 13 個 layer 都正常
2. `bash scripts/deploy/upload-deploy-assets.sh` 上傳到 S3
3. push branch + 開 PR + merge

## 執行日誌

（每完成 / 失敗一檔在這裡 append 一行，含時間 + tippecanoe stdout 關鍵行 + 壓縮比 / 錯誤訊息）

```
（執行時 append）
```
