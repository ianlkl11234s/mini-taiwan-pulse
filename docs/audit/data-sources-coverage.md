# 資料來源配對結果 — Step 1 完成報告

**日期**：2026-07-01
**計畫文件**：[`docs/proposal/data-sources-ssot-bridge.md`](../proposal/data-sources-ssot-bridge.md)
**全部 CSV / 報告**：`docs/audit/data_sources_*.csv` + `scratchpad/audit/` (Phase 0-5)

---

## 1. 總結數字

| 指標 | 數量 | 占比 |
|---|---|---|
| **Pulse layer 總數** | **227** | 100% |
| ✅ **verified**（橋接到 catalog dataset）| **185** | **81.5%** |
| ⚙️ `pulse_only`（派生分析，無獨立 dataset）| 3 | 1.3% |
| 📋 `catalog_missing`（catalog 待補登）| 39 | 17.2% |
| **Catalog dataset 總數** | **261** | — |
| 被 pulse 引用的 dataset | 129 | 49.4% |

> **Phase 3.5 修正**：初版 agent 把 33 個 layer 誤標 pulse_only（看到 three_only / 動態就歸類）。手動 review + catalog 內容驗證後，30 個重新分類為 verified 或 catalog_missing，真正純前端派生只剩 3 個（醫療等時圈、醫療沙漠、救援等時圈）。詳見 `scratchpad/audit/08_pulse_only_fix_report.md`。

> **Phase 3.6 對抗式修正**：第二輪 adversarial agent 找到 4 個誤判 + 1 個漏判：
> - 誤判改 catalog_missing：`taipeiSewer`（即時水位 ≠ 靜態污水廠）、`ecoNetworkZones`（綠網分區無對應）、`farmRoads`（農路 ≠ 林道）
> - 修配對：`facPrimary` / `facSecondary` 由 power_generation（即時出力）改 power_plants（靜態廠址）
> - 漏判改 verified：`a1AccidentRealtime` → `traffic_accident`（catalog 已有）
> 詳見 `scratchpad/audit/09_adversarial_review_report.md`。

### Verified 信心分布

| Confidence | Count | 來源規則 |
|---|---|---|
| HIGH | 76 | R0（catalog `frontend_target` 直接指向 pulse 路徑）+ 中文 label 直接命中 + 手動修正 |
| MED | 74 | R4（layer_key normalize ↔ dataset_id normalize）+ 主題對齊變體 + 手動修正 |
| LOW | 37 | R5（≥2 共享 token）+ 部分匹配 |

---

## 2. 主題覆蓋率（Phase 3.5 修正後）

| 主題 | Total | Verified | pulse_only | catalog_missing | 覆蓋率 |
|---|---:|---:|---:|---:|---:|
| 底圖 Base Map | 9 | 9 | 0 | 0 | 100% ✅ |
| 水資源 Water | 22 | 22 | 0 | 0 | 100% ✅ |
| 全球氣候 Global Climate | 5 | 5 | 0 | 0 | 100% ✅ |
| 農業 Agriculture | 12 | 12 | 0 | 0 | 100% ✅ |
| 林業 Forestry | 13 | 13 | 0 | 0 | 100% ✅ |
| 廢棄物 Waste | 18 | 18 | 0 | 0 | 100% ✅ |
| 基礎建設 Infrastructure | 4 | 4 | 0 | 0 | 100% ✅ |
| 房地產 Real Estate | 6 | 6 | 0 | 0 | 100% ✅ |
| 新聞 News | 1 | 1 | 0 | 0 | 100% ✅ |
| 民防避難 Civil Defense | 1 | 1 | 0 | 0 | 100% ✅ |
| 警察覆蓋分析 Police Coverage | 3 | 3 | 0 | 0 | 100% ✅ |
| 執法治安 Law & Order | 17 | 16 | 0 | 1 | 94% |
| 交通 Move | 29 | 26 | 0 | 3 | 90% |
| 能源 Energy | 37 | 32 | 0 | 5 | 86% |
| 人口社經 People | 6 | 5 | 0 | 1 | 83% |
| 消防 Fire & Rescue | 5 | 4 | 1 | 0 | 80% |
| 醫療 Medical | 7 | 5 | 2 | 0 | 71% |
| 環境氣候 Environment | 7 | 3 | 0 | 4 | 43% |
| 災害 Hazard | 9 | 2 | 0 | 7 | 22% |
| 太空 Space | 16 | 0 | 0 | 16 | 0% ※ |

※ 太空 Space 16 個 layer 全部走外部 API（CelesTrak / Space-Track），catalog 確實未登錄，列入 catalog_missing 待補。

---

## 3. 驗證方法

### 對抗式驗證（Phase 3 抽 20 筆）

| Confidence | 抽驗 | 對 | 部分對 | 誤 |
|---|---|---|---|---|
| HIGH | 10 | 10 ✓ | 0 | 0 |
| MED | 10 | 8 ✓ | 2 ⚠ | 0 |

兩個 MED 略寬鬆但語意相關：`iotWraStructure→dam_weirs_wra`、`wfMonitoring→waste_facilities`。

### Reverse validation（CI 守門）

新測試 `src/data/__tests__/upstreamRegistry.test.ts` 4 條：
1. UPSTREAM_REGISTRY 涵蓋每個 LAYER_COLORS key
2. 無 orphan key
3. status / datasets 形狀一致
4. 每個 verified datasetId 真實存在於 catalog（cross-repo check）

**目前 `pnpm test`：159 / 159 ✓**

---

## 4. 5 個階段執行軌跡

| Phase | 動作 | 工具 / 腳本 | 產出 |
|---|---|---|---|
| 1 | 基線盤點 | `01_enumerate_pulse_layers.ts` + `02_enumerate_catalog_datasets.py` | pulse 227 / catalog 261 CSV |
| 2 | 機械化配對 R0-R5 | `03_propose_matches.ts` | match_proposal.csv（HIGH 15 / MED 33 / LOW 37 / NONE 142）|
| 3 | Claude 對抗式 review + agent hunt | `04_review_matches.py` + Explore agent + `05_merge_hunt.py` | match_final.csv（175 verified） |
| 4 | 雙向寫入 + lint | `06_apply_to_pulse.py` + `07_apply_to_catalog.py`（dry-run）| `src/data/upstreamRegistry.ts` + catalog_diff.patch |
| 5 | 最終報告 | 本檔 | docs/audit/data-sources-coverage.md |

**腳本檔案位置**：
- pulse：`mini-taiwan-pulse/scripts/audit/01,03,06.{ts,py}`
- catalog：`taipei-gis-analytics/scripts/audit/02,07.py`

---

## 5. 給後續 Step 2-4 的入口

| Step | 內容 | Repo |
|---|---|---|
| **Step 2** | `reference.data_catalog` table + `public.get_data_catalog_for_layer()` RPC | gis-platform |
| **Step 3** | `scripts/sync_catalog_to_supabase.py` + GitHub Action | taipei-gis-analytics |
| **Step 4** | 前端「資料來源」icon + 浮窗 UI（C 方案）| mini-taiwan-pulse |

Step 4 前端 UI 已有完整 fuel：
- 直接讀 `UPSTREAM_REGISTRY` → 拿到 layer → dataset_id
- fetch Supabase RPC `get_data_catalog_for_layer(layerKey)` → 拿到上游機關 / URL / 頻率 / 授權

---

## 6. catalog_missing 37 筆（給 Step 2 之前 catalog 補登）

| 主題 | layer_keys |
|---|---|
| 太空 Space (16) | satellitesTaiwan/Yaogan/Jilin/Gaofen/TJS/Beidou/Shiyan + USA/Japan/Russia/India/Korea/France/Germany/Italy/Israel — 全部 CelesTrak / Space-Track 外部 API |
| 災害 Hazard (7) | lifelineAlerts, floodAlerts, weatherAlerts, transitAlerts, safetyAlerts, lightning, nuclearRadiation |
| 能源 Energy (5) | geothermalWells, renewablePermitsTaipei, fossilFuelInfra, gasCoverageAll, evIsland |
| 環境氣候 Environment (4) | cwaCloudImagery, cwaRadarImagery, aqiStations, aqiMicroSensors |
| 交通 Move (3) | flights, busLive, busIntercityLive |
| 執法治安 Law & Order (1) | a1AccidentRealtime |
| 人口社經 People (1) | h3Population |

→ 多為外部即時 API（CWA imagery / CelesTrak / TDX 即時）或 RPC 對應的上游 dataset 尚未在 catalog 立 .md。

詳見 `docs/audit/data_sources_pending_catalog.md` 與 `scratchpad/audit/08_pulse_only_fix_report.md`。

---

## 7. pulse_only 3 筆（純派生分析，含完整 lineage）

| layer_key | derivedFrom | processing |
|---|---|---|
| `medIsochrone` | `medHospital`, `medClinic` | OSRM 路網等時圈計算（駕車 5/10/15/30 分鐘）|
| `medDesert` | `medIsochrone` | 等時圈反演 — 距任一醫療設施駕車 > 30 分鐘的村里標為醫療沙漠 |
| `fireIsochrone` | `fireStations` | OSRM 路網等時圈計算（救援 ≤ 5/8/10 分鐘）|

→ 這 3 個都記在 `UPSTREAM_REGISTRY` 的 `derivedFrom + processing` 欄位，UI 可顯示「派生自 X，使用 Y 處理」。

---

## 8. 已知限制 / 後續優化

1. **34 個 LOW confidence** 配對信心較低（R5 token overlap），Step 4 UI 顯示時建議標 `⚠️ 待人工確認`
2. **`gas_stations` 8× / `osm_power` 6×** 等 multi-dataset，未來 Step 4 可在 frontmatter `used_by_pulse_layers` 列表多 layer，UI 顯示「此 dataset 服務 N 個圖層」
3. **34 stale LAYER_COLORS key**（如 `medICUBeds, wasteRoute` 等）已標 `pulse_only`，未來清理時可一起刪
4. **catalog 端 125 個 .md 的 `used_by_pulse_layers:` 寫入仍是 dry-run**，用戶決定何時 `python3 scripts/audit/07_apply_to_catalog.py --apply`

---

## 附錄：完整輸出檔清單

| 檔案 | 用途 |
|---|---|
| `docs/audit/data-sources-coverage.md` | 本檔（最終報告） |
| `docs/audit/data_sources_match_final.csv` | 227 layer 完整配對結果 |
| `docs/audit/data_sources_pending_catalog.md` | 19 catalog_missing + 100 hunt 詳細 |
| `src/data/upstreamRegistry.ts` | Bridge SSOT（pulse 端） |
| `src/data/__tests__/upstreamRegistry.test.ts` | 一致性 CI 守門 |
| `scratchpad/audit/01-04_*.md` | 各 phase 詳報告（不入 git） |
| `scratchpad/audit/catalog_diff.patch` | catalog 端待 apply 變更摘要 |
