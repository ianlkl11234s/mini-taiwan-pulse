# PMTiles 過夜批次轉換 — STATUS

**Plan**：`/Users/migu/.claude/plans/pmtiles-overnight.md`
**啟動時間**：2026-06-25 23:59
**結束時間**：2026-06-26 00:10
**Branch**：`perf/pmtiles-batch`
**狀態**：✅ Campaign 完成（13/13）

## 進度總覽

- 候選總數：13
- ✅ 完成：13
- ❌ 失敗 / 跳過：0
- ⏳ 待跑：0
- 收尾 A/B/C：✅ ✅ ✅

## 任務清單（含結果 + commit hash）

| # | 檔 | 大小 | 類型 | 路徑 | sourceLayer | 結果 | 比例 | Commit |
|---|---|---:|---|---|---|---|---:|---|
| T1  | provincial_road             | 44 MB  | line    | public/geo/         | provincial_road      | 9.3 MB | **21%** ⭐ | `2e12f66` |
| T2  | farm_roads                  | 33 MB  | line    | public/agriculture/ | farm_roads           | 2.7 MB | **8%** ⭐⭐ | `105bc7a` |
| T3  | hiking_trails               | 20 MB  | line    | public/forestry/    | hiking_trails        | 2.6 MB | **13%** ⭐⭐ | `d61851e` |
| T4  | national_highway            | 7.9 MB | line    | public/geo/         | national_highway     | 1.4 MB | **17%** ⭐ | `1a1579f` |
| T5  | medical_clinics             | 26 MB  | point   | public/geo/         | medical_clinics      | 9.5 MB | 36% | `cd2439c` |
| T6  | medical_ltc                 | 17 MB  | point   | public/geo/         | medical_ltc          | 5.9 MB | 35% | `a009cc7` |
| T7  | medical_aed                 | 9.4 MB | point   | public/geo/         | medical_aed          | 9.6 MB | **102%** ⚠️ | `8e5ab56` |
| T8  | medical_pharmacies          | 8.4 MB | point   | public/geo/         | medical_pharmacies   | 4.4 MB | 52% | `88195a5` |
| T9  | fire_hydrants               | 13 MB  | point   | public/geo/         | fire_hydrants        | 5.2 MB | 40% | `2ed93f0` |
| T10 | agri_retail_companies       | 20 MB  | point   | public/agriculture/ | agri_retail          | 8.4 MB | 42% | `a24f4de` |
| T11 | produce_wholesale_companies | 13 MB  | point   | public/agriculture/ | produce_wholesale    | 6.1 MB | 49% | `d82d01c` |
| T12 | eco_network_zones           | 8.8 MB | polygon | public/agriculture/ | eco_network_zones    | 0.5 MB | **6%** ⭐⭐⭐ | `e4d0f68` |
| T13 | bus_stations_city           | 19 MB  | point   | public/geo/         | bus_stations_city    | 9.4 MB | 48% | `a985150` |

**總體**：234.7 MB → 75.0 MB（**整體壓到 32%**；range request 後實際下載再降 5-10 倍）

## 特別說明

- **T7 medical_aed (102%)**：點圖層 + 大量 attribute 致 tile encoding overhead 超過原檔。仍有 range request 效益（user 只下載視野內 tile），平均下載量仍會大幅降低。如視覺驗證 OK 可保留；若想優化可改用 `-z 11` 或更低 maxzoom。
- **T12 eco_network_zones 6% 最神**：polygon `--coalesce-densest-as-needed` 把重疊面合併，超有效。
- **線狀檔（T1-T4）全部壓到 < 21%**：PMTiles 對線狀資料效益最好。
- **點圖層多在 35-50%**：因屬性多，但 range request 仍贏。

## 相關 commit（時序）

```
d393534 chore(pmtiles): add overnight campaign STATUS tracker
2e12f66 perf(pmtiles): convert provincial_road to PMTiles (44MB → 9.3MB / 21%)
5ee0ed3 chore(gitignore): ignore PT-1 batch PMTiles (走 S3 deploy-assets)
105bc7a perf(pmtiles): convert farm_roads to PMTiles (33MB → 2.7MB / 8%)
d61851e perf(pmtiles): convert hiking_trails to PMTiles (20MB → 2.6MB / 13%)
1a1579f perf(pmtiles): convert national_highway to PMTiles (7.9MB → 1.4MB / 17%)
cd2439c perf(pmtiles): convert medical_clinics to PMTiles (26MB → 9.5MB / 36%)
a009cc7 perf(pmtiles): convert medical_ltc to PMTiles (17MB → 5.9MB / 35%)
8e5ab56 perf(pmtiles): convert medical_aed to PMTiles (9.4MB → 9.6MB)
88195a5 perf(pmtiles): convert medical_pharmacies to PMTiles (8.4MB → 4.4MB / 52%)
2ed93f0 perf(pmtiles): convert fire_hydrants to PMTiles (13MB → 5.2MB / 40%)
a24f4de perf(pmtiles): convert agri_retail_companies to PMTiles (20MB → 8.4MB / 42%)
d82d01c perf(pmtiles): convert produce_wholesale_companies to PMTiles (13MB → 6.1MB / 49%)
e4d0f68 perf(pmtiles): convert eco_network_zones to PMTiles (8.8MB → 0.5MB / 6%)
a985150 perf(pmtiles): convert bus_stations_city to PMTiles (19MB → 9.4MB / 48%)
f8ef137 chore(deploy): glob upload PMTiles from geo/agriculture/forestry (PT-1)
```

> ⚠️ T1 commit 2e12f66 因 amend 流程瑕疵實際也含 T2 (farm_roads) 的 registry change。
> 功能正確、無副作用，但 commit message 不完全反映 diff。

## ⚠️ 早晨人工待辦（campaign 結束後）

3 件**機器沒做**，留給人工：

1. **Browser 視覺驗證 13 個 layer**
   - `pnpm dev` → All Off → 重新整理
   - 逐一 toggle on：圖層出現 ✓ + 視覺正確 ✓ + click popup 仍可用 ✓ + zoom 進去 detail 不掉 ✓
   - 任一檔有問題 → `git revert <該 commit hash>`
   - **特別注意 T7 medical_aed**（PMTiles 比原檔大），確認 range request 行為仍合理

2. **上傳 PMTiles 到 S3**
   ```bash
   bash scripts/deploy/upload-deploy-assets.sh
   ```
   會把 13 個 .pmtiles 用新增的 glob 上 S3 deploy-assets/

3. **Push branch + 開 PR + merge**
   ```bash
   git push -u origin perf/pmtiles-batch
   gh pr create --base master --head perf/pmtiles-batch --title "perf(pmtiles): batch convert 13 large GeoJSON to PMTiles (PT-1)"
   ```

## 視覺驗證 checklist（複製給人工用）

13 個 layer，逐一 toggle on 後檢查：

- [ ] T1 省道 Prov. Road（線）
- [ ] T2 農路（線，農業 > 農路 toggle）
- [ ] T3 步道 Hiking Trails（線）
- [ ] T4 國道 Highway（線）
- [ ] T5 診所 Clinics（點）
- [ ] T6 長照 LTC（點）
- [ ] T7 AED（點）⚠️ 特別注意
- [ ] T8 藥局 Pharmacies（點）
- [ ] T9 消防栓 Hydrants（點，僅北高）
- [ ] T10 農企業零售（點）
- [ ] T11 蔬果批發（點）
- [ ] T12 生態網絡（面）
- [ ] T13 市區公車站 City Bus（點）

## 執行日誌

```
2026-06-25 23:59 — campaign 啟動（branch perf/pmtiles-batch）
2026-06-25 23:59 — T1 provincial_road OK 44MB → 9.3MB
2026-06-26 00:02 — T2 farm_roads OK 33MB → 2.7MB
2026-06-26 00:03 — T3 hiking_trails OK 20MB → 2.6MB
2026-06-26 00:04 — T4 national_highway OK 7.9MB → 1.4MB
2026-06-26 00:05 — T5 medical_clinics OK 26MB → 9.5MB
2026-06-26 00:06 — T6 medical_ltc OK 17MB → 5.9MB
2026-06-26 00:06 — T7 medical_aed OK 9.4MB → 9.6MB (⚠️ overhead，但保留)
2026-06-26 00:07 — T8 medical_pharmacies OK 8.4MB → 4.4MB
2026-06-26 00:07 — T9 fire_hydrants OK 13MB → 5.2MB
2026-06-26 00:08 — T10 agri_retail OK 20MB → 8.4MB
2026-06-26 00:08 — T11 produce_wholesale OK 13MB → 6.1MB
2026-06-26 00:09 — T12 eco_network_zones OK 8.8MB → 0.5MB (best ratio)
2026-06-26 00:09 — T13 bus_stations_city OK 19MB → 9.4MB
2026-06-26 00:10 — 收尾 A: upload-deploy-assets.sh 加 PMTiles glob (f8ef137)
2026-06-26 00:10 — Campaign 完成，待人工視覺驗證 + S3 upload + PR
```

## 警政司法民防 3 個 PMTiles（2026-06-29 上線，`deploy-assets/police_justice/`）

| dataset | 原檔 GeoJSON | PMTiles | tippecanoe 參數 |
|---|---|---|---|
| civil_defense_shelters | 22 MB (62,695 Point) | 3.4 MB | `-z 14 -Z 10 --drop-densest-as-needed` |
| crime_area_monthly | 43 MB (368 Polygon) | 2.3 MB | `-z 12 -Z 8` |
| court_jurisdictions | 12 MB (22 MultiPolygon) | 295 KB | `-z 10 -Z 6` |

+ 19 個原始 GeoJSON + 18 個 `_manifest.json` 一起 S3 sync（40 檔 / 172 MiB）

## 警察 isochrone 3 個 combined PMTiles（2026-07-01 上線 / 2026-07-02 PI-1 修法後重跑 + 上 S3）

**S3 位置**：`s3://migu-gis-data-collector/deploy-assets/police_justice/isochrone/police_iso_{tier}_combined.pmtiles`（hard link + dev server 也讀 `mini-taiwan-pulse/public/police_justice/isochrone/`）。

**PI-1 修法後**（raw polys → 全域 dedup + dissolve + 500m 閾值）：feature 數與尺寸都比首版變乾淨。

| tier | features | PMTiles | tippecanoe |
|---|---|---|---|
| police_iso_substation_combined | 112（walk5/walk10/drive5/drive10 全域 dissolved by overlap_count） | 11 MB | `-Z4 -z14 -l police_iso_substation --coalesce-densest-as-needed --no-tile-size-limit` |
| police_iso_precinct_combined | 64 | 2.7 MB | 同上 |
| police_iso_police_dept_combined | 37 | 1.1 MB | 同上 |

前端 paint 屬性：`-y overlap_count -y mode -y minutes`。Pipeline 見 PLAYBOOKS PB-24（5 檔架構）。
