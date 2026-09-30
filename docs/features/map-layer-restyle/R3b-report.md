# R3b 線面（hook）＋網格／影像／文字／擠出

PR：[ #475 ](https://github.com/ianlkl11234s/mini-taiwan-pulse/pull/475)。

狀態：使用者於 2026-09-30 確認建議＋D 區修正；本分支實作，待 Claude 驗收，未 merge。

基準：`origin/master` 的 `84c9fef9`；第一段提案 commit `4d84c90c`；樣式實作 `af169b58`、lifecycle 修正 `4f4b40e4`。比較頁：[r3b-compare.html](./r3b-compare.html)。

## 驗收（handoff §7）

| 驗收 | 結果 |
|---|---|
| `npx tsc -b` | 通過（exit 0）；未以 `--noEmit` 代替最終驗收 |
| `npx vitest run --maxWorkers=3` | 449 files：431 passed、12 failed、6 skipped；2781 passed／16 failed／26 skipped，另一次 worker onTaskUpdate timeout |
| 單工重跑 | 11 檔 research 全通過；第 12 檔為 layerParamsControls 舊高度文案斷言，改為「高度倍率 1.00」後 24 tests 通過 |
| 最後 lifecycle 複驗 | overlayManager 38＋PropertyValueAdmin 1 tests 通過；最終 `npx tsc -b` exit 0 |
| 設計系統與比較頁 | design:snapshot 成功；24 張內嵌圖片完整解碼、淡色切換與原尺寸 dialog 通過 |
| 整合後 focused | 5 files／37 tests 通過：hook 分階、G4/T3/F4、static line 不重送 geometry、日本醫療 theme 不重算、GlobalEvents theme 不重抓 |
| design guard | 15 tests 通過，未更動 guard 或基準 |
| 圖例 | legendAlignment 14＋legendKit 8 tests 通過 |
| 黃金快照 | 814 keys；88 個逐屬性差異，明細見文末；golden snapshot 15 tests 通過 |
| design:audit-layers | `legendsWithIssues` 3 → 3；814 keys、318 configs、525 runtime 子層不變；551 legend entries 不變 |
| 瀏覽器 | 24 張 1200×800 實際截圖，A 軌道／H3、B 公司資本額、C 熱島、D 公共廁所、E GBA 建物；暗／淡 × master／R3b，圖片內嵌 `r3b-compare.html`。port 3749、WebGL flags、深連結 v=1。 |
| 滑桿 | A–E min／default／max paint 符合比例且不超過 1，詳見下表；E 初測揭露既有 rebuild 問題並修復後複驗。 |

research 重跑清單：capabilityAudit、civilDefenseSheltersOwnerDataset、companyCapitalGridFineOwnerDatasets、companyPointsDataset、discovery、medLtcOwnerDataset、nhiMedicalOwnerDatasets、pollutionPenaltiesDataset、regulatedFacilitiesOwnerDataset、religionTemplesOwnerDataset、treePitsTaipeiOwnerDataset。單工重跑合計 62 tests 通過（含 layerParamsControls 的 23 個原通過項目），再重跑 layerParamsControls 24/24 通過。

稽核輸出的 hook 分類來自靜態掃描：共享 helper 新增 import 會使其他同檔／同 helper 的引用證據與行號也更新，並非這些圖層的 runtime paint 改動。static-scan 170 → 173、unresolved 30 → 27；PropertyValueAdmin legend 由圓形改方形。沒有修改稽核腳本或放寬基準。


### 瀏覽器滑桿讀值（app layerParamsStore.setParam）

| 區／樣本 | min → paint | 預設 → paint | max → paint | 資料更新觀測 |
|---|---|---|---|---|
| A / h3Population | 0.1 → 0.09166667 | 0.6 → 0.55 | 1 → 0.91666667 | fetch 0／setData 0 |
| B / companyCapitalGrid | 0.1 → 0.08235294 | 0.85 → 0.7 | 1 → 0.82352941 | fetch 0／setData 0 |
| C / urbanHeat | 0.3 → 0.3 | 0.7 → 0.7 | 1 → 1 | fetch 0／setData 0 |
| D / publicToilets | 0.1 → 0.1 | 0.75 → 0.75 | 1 → 1 | fetch 0／setData 0 |
| E / buildingsGba | 0 → 0 | 0.75 → 0.85 | 1 → 1 | fetch 0／setData 0（修復後複驗） |

建物初測因既有 `rebuildOnParamChange` 在 paint 改動時重建兩層，出現 18 次 PMTiles 請求。已將 buildingsGba 重建條件收窄為高度門檻參數；透明度／主題／呈現模式走 paint diff。測試涵蓋高度門檻仍更新 filter、遺失層仍恢復、hidden 狀態保留。修復後同視角滑桿測得 fetch 0／setData 0、可見建物 3,763 個。PropertyValueAdmin 也將 feature-state 寫入與 paint effect 分開，測試先完成資料套用再切主題／透明度，確認不重送 feature-state。

## 盤點與實作範圍

- 第一段 225 列：A 184（100 fill／84 line，含 16 裝飾或例外）、B 14、C 9、D 9 個選項／10 子層、E 9。
- 第二段更正 D：`noiseCapture-count` 是第一段誤標，程式實際為 `newsEvents/count`；NoiseCapture 無 symbol，因此不擴大修改新聞層。實際 D 為 8 個選項／9 子層。第一段頁保留原提案以便追溯。
- HOOK 表為 76 line 與 92 fill 紀錄；共享醫療 aggregate 以目前可見類別的透明度 winner 選相對 default。16 裝飾／互動子層不套階。
- B 14 層不改零值、缺值、filter、資料、遮罩或覆蓋語意。A 的 H3 填色分階仍依確認版改為 0.55；B 的「維持」是維持其來源／空格判定。

## A：逐層與子圖層

數值為滑桿預設時的新 paint；線寬寫 z10→z14。資料驅動 expression 優先保留（含外框色、dash、selected／age opacity）。滑桿更新與初次建層共用 `lineWrap`／`fillWrap`／`outlineWrap`，比例為原值／同主題原預設，上限 1。

| layer key | 子圖層 | 確認階 | 改前 → 改後 | helper |
|---|---|---|---|---|
| allenCoralAtlas | allen-coral-atlas-benthic-fill | coverage | {"fill-opacity":"opacity"} → fill-opacity 0.35 | hookFillPaint／hookFillOpacity |
| allenCoralAtlas | allen-coral-atlas-geomorphic-fill | coverage | {"fill-opacity":"opacity"} → fill-opacity 0.35 | hookFillPaint／hookFillOpacity |
| animalShelterPressure | animal-shelter-pressure-fill | coverage | {"fill-opacity":"opacity","fill-outline-color":"\"rgba(0,0,0,0)\""} → fill-opacity 0.35 | hookFillPaint／hookFillOpacity |
| animalShelterPressure | animal-shelter-pressure-line | {"width":"keep","opacity":"keep","outline":"coverage"} | {"line-width":"[\"interpolate\", [\"linear\"], [\"zoom\"], 4, 0.5, 10, 1.2]","line-opacity":"opacity * 0.7"} → 1px／0.8／原色 | hookLinePaint／hookLineWidth／hookLineOpacity |
| aspectVector | aspect-vector-fill | coverage | {"fill-opacity":"opacity"} → fill-opacity 0.35 | hookFillPaint／hookFillOpacity |
| aviationControl | aviation-control-fill | coverage | {"fill-opacity":"controlFillOpacity"} → fill-opacity 0.35 | hookFillPaint／hookFillOpacity |
| aviationControl | aviation-control-line | {"width":"standard","opacity":"reference"} | {"line-width":"[\"interpolate\", [\"linear\"], [\"zoom\"], 4, 0.6, 8, 1.4, 12, 2.2]","line-opacity":"controlLineOpacity","line-dasharray":"[4, 2]"} → width 1→2；opacity .6 | hookLinePaint／hookLineWidth／hookLineOpacity |
| aviationRestricted | aviation-restricted-fill | coverage | {"fill-opacity":"restrictedFillOpacity"} → fill-opacity 0.35 | hookFillPaint／hookFillOpacity |
| aviationRestricted | aviation-restricted-line | {"width":"standard","opacity":"reference"} | {"line-width":"[\"interpolate\", [\"linear\"], [\"zoom\"], 6, 0.4, 10, 1.0, 12, 1.6]","line-opacity":"restrictedLineOpacity"} → width 1→2；opacity .6 | hookLinePaint／hookLineWidth／hookLineOpacity |
| aviationRestrictedGlow | aviation-restricted-glow-core | 排除 | {"line-width":"width","line-opacity":"paintOpacity"} → 維持：裝飾／互動／不套階 | — |
| aviationRestrictedGlow | aviation-restricted-glow-fill | 排除 | {"fill-opacity":"0.06 * opacity"} → 維持：裝飾／互動／不套階 | — |
| aviationRestrictedGlow | aviation-restricted-glow-halo-far | 排除 | {"line-width":"width","line-opacity":"paintOpacity"} → 維持：裝飾／互動／不套階 | — |
| aviationRestrictedGlow | aviation-restricted-glow-halo-mid | 排除 | {"line-width":"width","line-opacity":"paintOpacity"} → 維持：裝飾／互動／不套階 | — |
| aviationRestrictedGlow | aviation-restricted-glow-halo-near | 排除 | {"line-width":"width","line-opacity":"paintOpacity"} → 維持：裝飾／互動／不套階 | — |
| bridgeResilienceTwinCity | string | 排除 | {} → 維持：裝飾／互動／不套階 | — |
| bssNationalBridgePreview | bss-national-bridge-preview-multi-near-carrier-waterway-context | {"width":"emphasis","opacity":"keep"} | {"line-width":"z15=4","line-opacity":"clamp(opacity.bssNationalBridgePreview)","line-dasharray":"[2,1]"} → width 2→3.5；opacity 保留 | hookLinePaint／hookLineWidth／hookLineOpacity |
| bssNationalBridgePreview | bss-national-bridge-preview-near-curved-carrier-local-context | {"width":"emphasis","opacity":"keep"} | {"line-width":"z15=4","line-opacity":"clamp(opacity.bssNationalBridgePreview)","line-dasharray":"[2,1]"} → width 2→3.5；opacity 保留 | hookLinePaint／hookLineWidth／hookLineOpacity |
| bssNationalBridgePreview | bss-national-bridge-preview-no-crossing-nearest-route-context | {"width":"emphasis","opacity":"keep"} | {"line-width":"z15=4","line-opacity":"clamp(opacity.bssNationalBridgePreview)","line-dasharray":"[1,2]"} → width 2→3.5；opacity 保留 | hookLinePaint／hookLineWidth／hookLineOpacity |
| bssNationalBridgePreview | bss-national-bridge-preview-no-waterway-carrier-consensus-context | {"width":"emphasis","opacity":"keep"} | {"line-width":"z15=4","line-opacity":"clamp(opacity.bssNationalBridgePreview)","line-dasharray":"[1,2]"} → width 2→3.5；opacity 保留 | hookLinePaint／hookLineWidth／hookLineOpacity |
| bssNationalBridgePreview | bss-national-bridge-preview-offset-direction-line | {"width":"emphasis","opacity":"keep"} | {"line-width":"z15=3.4","line-opacity":"clamp(opacity.bssNationalBridgePreview)","line-dasharray":"[1.5,1]"} → width 2→3.5；opacity 保留 | hookLinePaint／hookLineWidth／hookLineOpacity |
| bssNationalBridgePreview | bss-national-bridge-preview-ordinary-route-context | {"width":"emphasis","opacity":"keep"} | {"line-width":"z15=4","line-opacity":"clamp(opacity.bssNationalBridgePreview)","line-dasharray":"[2,1]"} → width 2→3.5；opacity 保留 | hookLinePaint／hookLineWidth／hookLineOpacity |
| bssNationalBridgePreview | bss-national-bridge-preview-original-direction-line | {"width":"emphasis","opacity":"keep"} | {"line-width":"z15=3.4","line-opacity":"clamp(opacity.bssNationalBridgePreview)"} → width 2→3.5；opacity 保留 | hookLinePaint／hookLineWidth／hookLineOpacity |
| bssNationalBridgePreview | bss-national-bridge-preview-stage1-local-direction-candidate | {"width":"emphasis","opacity":"keep"} | {"line-width":"z15=3.4","line-opacity":"clamp(opacity.bssNationalBridgePreview)","line-dasharray":"[1,1]"} → width 2→3.5；opacity 保留 | hookLinePaint／hookLineWidth／hookLineOpacity |
| bssNationalBridgePreview | bss-national-bridge-preview-tied-route-consensus-context | {"width":"emphasis","opacity":"keep"} | {"line-width":"z15=4","line-opacity":"clamp(opacity.bssNationalBridgePreview)","line-dasharray":"[1,2]"} → width 2→3.5；opacity 保留 | hookLinePaint／hookLineWidth／hookLineOpacity |
| bssNationalBridgePreview | bss-national-bridge-preview-waterway-crossing-context | {"width":"emphasis","opacity":"keep"} | {"line-width":"z15=4","line-opacity":"clamp(opacity.bssNationalBridgePreview)","line-dasharray":"[2,1]"} → width 2→3.5；opacity 保留 | hookLinePaint／hookLineWidth／hookLineOpacity |
| coralReefDistribution | coral-reef-distribution-fill | coverage | {"fill-opacity":"opacity"} → fill-opacity 0.35 | hookFillPaint／hookFillOpacity |
| coralReefDistribution | coral-reef-distribution-line | {"width":"thin","opacity":"reference"} | {"line-width":"[\"interpolate\", [\"linear\"], [\"zoom\"], 0, 0.4, 10, 1]","line-opacity":"opacity"} → width .5→1；opacity .6 | hookLinePaint／hookLineWidth／hookLineOpacity |
| droneNoFlyZone | drone-nfz-fill | coverage | {"fill-opacity":"nfzOpacity"} → fill-opacity 0.35 | hookFillPaint／hookFillOpacity |
| droneNoFlyZone | drone-nfz-line | {"width":"standard","opacity":"standard"} | {"line-width":"z14=2","line-opacity":"min(1,nfzOpacity+0.3)"} → width 1→2；opacity .85 | hookLinePaint／hookLineWidth／hookLineOpacity |
| droneRestrictedZone | drone-restricted-fill | coverage | {"fill-opacity":"restrictedOpacity"} → fill-opacity 0.35 | hookFillPaint／hookFillOpacity |
| droneRestrictedZone | drone-restricted-line | {"width":"standard","opacity":"standard"} | {"line-width":"z14=2","line-opacity":"min(1,restrictedOpacity+0.3)"} → width 1→2；opacity .85 | hookLinePaint／hookLineWidth／hookLineOpacity |
| floodAlerts | floodAlerts-fill | keep | {"fill-opacity":"SEVERITY_FILL_OPACITY"} → 保留原 expression | hookFillPaint／hookFillOpacity |
| floodAlerts | floodAlerts-line | {"width":"standard","opacity":"standard"} | {"line-width":"1.5","line-opacity":"0.9"} → width 1→2；opacity .85 | hookLinePaint／hookLineWidth／hookLineOpacity |
| floodSensorIsochrone | flood-sensor-isochrone-fill | coverage | {"fill-opacity":"0.45 * opacity"} → fill-opacity 0.35 | hookFillPaint／hookFillOpacity |
| floodSensorIsochrone | flood-sensor-isochrone-line | {"width":"thin","opacity":"reference"} | {"line-width":"0.5","line-opacity":"0.5 * opacity"} → width .5→1；opacity .6 | hookLinePaint／hookLineWidth／hookLineOpacity |
| freewayCongestion | freewayCongestion-glow | 排除 | {"line-width":"8 * width","line-opacity":"(isDark ? 0.08 : 0.12) * opacity"} → 維持：裝飾／互動／不套階 | — |
| freewayCongestion | freewayCongestion-hit | 排除 | {"line-width":"12","line-opacity":"0"} → 維持：裝飾／互動／不套階 | — |
| freewayCongestion | freewayCongestion-line | {"width":"emphasis","opacity":"standard"} | {"line-width":"[\n          \"interpolate\",\n          [\"linear\"],\n          [\"zoom\"],\n          6, 0.5 * width,\n          10, 1.5 * width,\n          13, 3 * width,\n          16, 5 * width,\n        ]","line-opacity":"(isDark ? 0.75 : 0.65) * opacity"} → width 2→3.5；opacity .85 | hookLinePaint／hookLineWidth／hookLineOpacity |
| funeralOperatorDensity | funeral-density-fill | graded | {"fill-opacity":"opacityRef.current"} → fill-opacity 0.55 | hookFillPaint／hookFillOpacity |
| funeralOperatorDensity | funeral-density-line | {"width":"thin","opacity":"reference"} | {"line-width":"[\"interpolate\", [\"linear\"], [\"zoom\"], 7, 0.2, 13, 0.8]","line-opacity":"opacityRef.current * 0.5"} → width .5→1；opacity .6 | hookLinePaint／hookLineWidth／hookLineOpacity |
| gfwFishingEffort | gfw-fishing-effort-fill | coverage | {"fill-opacity":"0.55"} → fill-opacity 0.35 | hookFillPaint／hookFillOpacity |
| gfwFishingEffort | gfw-fishing-effort-outline | {"width":"thin","opacity":"reference"} | {"line-width":"[\"interpolate\", [\"linear\"], [\"zoom\"], 3, 0.25, 10, 0.8]","line-opacity":"0.72"} → width .5→1；opacity .6 | hookLinePaint／hookLineWidth／hookLineOpacity |
| gfwHourlyGrid | gfw-hourly-grid-fill | keep | {"fill-opacity":"GFW_HOURLY_GRID_V3_FILL_OPACITY"} → 保留原 expression | hookFillPaint／hookFillOpacity |
| gfwHourlyGrid | gfw-hourly-grid-hit-fill | 排除 | {"fill-opacity":"GFW_HOURLY_GRID_V3_FILL_OPACITY"} → 維持：裝飾／互動／不套階 | — |
| gfwHourlyGrid | gfw-hourly-grid-next-fill | keep | {"fill-opacity":"GFW_HOURLY_GRID_V3_FILL_OPACITY"} → 保留原 expression | hookFillPaint／hookFillOpacity |
| gfwHourlyGrid | gfw-hourly-grid-next-outline | {"width":"keep","opacity":"keep"} | {"line-width":"1","line-opacity":"0.85"} → width 保留；opacity 保留 | hookLinePaint／hookLineWidth／hookLineOpacity |
| gfwHourlyGrid | gfw-hourly-grid-outline | {"width":"keep","opacity":"keep"} | {"line-width":"1","line-opacity":"0.85"} → width 保留；opacity 保留 | hookLinePaint／hookLineWidth／hookLineOpacity |
| gfwHourlyGrid | gfw-hourly-grid-pmtiles-fill | keep | {"fill-opacity":"GFW_HOURLY_GRID_V3_FILL_OPACITY"} → 保留原 expression | hookFillPaint／hookFillOpacity |
| gfwHourlyGrid | gfw-hourly-grid-pmtiles-hit-fill | 排除 | {"fill-opacity":"GFW_HOURLY_GRID_V3_FILL_OPACITY"} → 維持：裝飾／互動／不套階 | — |
| gfwHourlyGrid | gfw-hourly-grid-pmtiles-next-fill | keep | {"fill-opacity":"GFW_HOURLY_GRID_V3_FILL_OPACITY"} → 保留原 expression | hookFillPaint／hookFillOpacity |
| gfwHourlyGrid | gfw-hourly-grid-pmtiles-next-hit-fill | 排除 | {"fill-opacity":"GFW_HOURLY_GRID_V3_FILL_OPACITY"} → 維持：裝飾／互動／不套階 | — |
| gfwHourlyGrid | gfw-hourly-grid-pmtiles-next-outline | {"width":"keep","opacity":"keep"} | {"line-width":"1","line-opacity":"0.85"} → width 保留；opacity 保留 | hookLinePaint／hookLineWidth／hookLineOpacity |
| gfwHourlyGrid | gfw-hourly-grid-pmtiles-next-warm | 排除 | {"fill-opacity":"GFW_HOURLY_GRID_V3_FILL_OPACITY"} → 維持：裝飾／互動／不套階 | — |
| gfwHourlyGrid | gfw-hourly-grid-pmtiles-outline | {"width":"keep","opacity":"keep"} | {"line-width":"1","line-opacity":"0.85"} → width 保留；opacity 保留 | hookLinePaint／hookLineWidth／hookLineOpacity |
| gfwHourlyGrid | gfw-hourly-grid-pmtiles-preload-fill | keep | {"fill-opacity":"GFW_HOURLY_GRID_V3_FILL_OPACITY"} → 保留原 expression | hookFillPaint／hookFillOpacity |
| gfwHourlyGrid | gfw-hourly-grid-pmtiles-preload-hit-fill | 排除 | {"fill-opacity":"GFW_HOURLY_GRID_V3_FILL_OPACITY"} → 維持：裝飾／互動／不套階 | — |
| gfwHourlyGrid | gfw-hourly-grid-pmtiles-preload-outline | {"width":"keep","opacity":"keep"} | {"line-width":"1","line-opacity":"0.85"} → width 保留；opacity 保留 | hookLinePaint／hookLineWidth／hookLineOpacity |
| gfwHourlyGrid | gfw-hourly-grid-pmtiles-preload-warm | 排除 | {"fill-opacity":"GFW_HOURLY_GRID_V3_FILL_OPACITY"} → 維持：裝飾／互動／不套階 | — |
| gfwHourlyGrid | gfw-hourly-grid-pmtiles-warm | 排除 | {"fill-opacity":"GFW_HOURLY_GRID_V3_FILL_OPACITY"} → 維持：裝飾／互動／不套階 | — |
| gfwHourlyTracks | gfw-hourly-tracks-line | {"width":"standard","opacity":"reference"} | {"line-width":"[\"interpolate\", [\"linear\"], [\"zoom\"], 4, 0.7, 7, 1.5, 11, 2.8]","line-opacity":"0.55"} → width 1→2；opacity .6 | hookLinePaint／hookLineWidth／hookLineOpacity |
| globalEvents | global-events-relations-line | {"width":"thin","opacity":"keep"} | {"line-width":"1","line-opacity":"0.22"} → width .5→1；opacity 保留 | hookLinePaint／hookLineWidth／hookLineOpacity |
| jpAdminBoundaries | jp-admin-municipality-fill | background | {"fill-opacity":"opacity"} → fill-opacity 0.15 | hookFillPaint／hookFillOpacity |
| jpAdminBoundaries | jp-admin-municipality-line | {"width":"standard","opacity":"reference"} | {"line-width":"z14=2","line-opacity":0.6} → width 1→2；opacity .6 | hookLinePaint／hookLineWidth／hookLineOpacity |
| jpAdminPrefecture | jp-admin-prefecture-fill | background | {"fill-opacity":"opacity"} → fill-opacity 0.15 | hookFillPaint／hookFillOpacity |
| jpAdminPrefecture | jp-admin-prefecture-line | {"width":"standard","opacity":"reference"} | {"line-width":"z14=2","line-opacity":0.6} → width 1→2；opacity .6 | hookLinePaint／hookLineWidth／hookLineOpacity |
| jpAirports | jp-airports-fill | coverage | {"fill-opacity":"opacity"} → fill-opacity 0.35 | hookFillPaint／hookFillOpacity |
| jpAirports | jp-airports-line | {"width":"standard","opacity":"reference"} | {"line-width":"z14=2","line-opacity":0.6} → width 1→2；opacity .6 | hookLinePaint／hookLineWidth／hookLineOpacity |
| jpCareCombined | jp-medical-care-aggregate-fill | graded | {"fill-opacity":"aggregateOpacity(definitions,visibility,params)"} → fill-opacity 0.55 | hookFillPaint／hookFillOpacity |
| jpCareCombined | jp-medical-care-aggregate-outline | {"width":"keep","opacity":"keep","outline":"graded"} | {"line-width":0.5,"line-opacity":0.4} → 1px／MAP_SEAM／暗0.6淡0.8 | hookLinePaint／hookLineWidth／hookLineOpacity |
| jpCareDayServices | jp-medical-care-aggregate-fill | graded | {"fill-opacity":"aggregateOpacity(definitions,visibility,params)"} → fill-opacity 0.55 | hookFillPaint／hookFillOpacity |
| jpCareDayServices | jp-medical-care-aggregate-outline | {"width":"keep","opacity":"keep","outline":"graded"} | {"line-width":0.5,"line-opacity":0.4} → 1px／MAP_SEAM／暗0.6淡0.8 | hookLinePaint／hookLineWidth／hookLineOpacity |
| jpCareEquipment | jp-medical-care-aggregate-fill | graded | {"fill-opacity":"aggregateOpacity(definitions,visibility,params)"} → fill-opacity 0.55 | hookFillPaint／hookFillOpacity |
| jpCareEquipment | jp-medical-care-aggregate-outline | {"width":"keep","opacity":"keep","outline":"graded"} | {"line-width":0.5,"line-opacity":0.4} → 1px／MAP_SEAM／暗0.6淡0.8 | hookLinePaint／hookLineWidth／hookLineOpacity |
| jpCareHomeVisit | jp-medical-care-aggregate-fill | graded | {"fill-opacity":"aggregateOpacity(definitions,visibility,params)"} → fill-opacity 0.55 | hookFillPaint／hookFillOpacity |
| jpCareHomeVisit | jp-medical-care-aggregate-outline | {"width":"keep","opacity":"keep","outline":"graded"} | {"line-width":0.5,"line-opacity":0.4} → 1px／MAP_SEAM／暗0.6淡0.8 | hookLinePaint／hookLineWidth／hookLineOpacity |
| jpCarePlanning | jp-medical-care-aggregate-fill | graded | {"fill-opacity":"aggregateOpacity(definitions,visibility,params)"} → fill-opacity 0.55 | hookFillPaint／hookFillOpacity |
| jpCarePlanning | jp-medical-care-aggregate-outline | {"width":"keep","opacity":"keep","outline":"graded"} | {"line-width":0.5,"line-opacity":0.4} → 1px／MAP_SEAM／暗0.6淡0.8 | hookLinePaint／hookLineWidth／hookLineOpacity |
| jpCareResidential | jp-medical-care-aggregate-fill | graded | {"fill-opacity":"aggregateOpacity(definitions,visibility,params)"} → fill-opacity 0.55 | hookFillPaint／hookFillOpacity |
| jpCareResidential | jp-medical-care-aggregate-outline | {"width":"keep","opacity":"keep","outline":"graded"} | {"line-width":0.5,"line-opacity":0.4} → 1px／MAP_SEAM／暗0.6淡0.8 | hookLinePaint／hookLineWidth／hookLineOpacity |
| jpMarineEbsaCoastal | jp-tourism-jp-marine-ebsa-coastal-fill | coverage | {"fill-opacity":"clampOpacity(opacity[key])"} → fill-opacity 0.35 | hookFillPaint／hookFillOpacity |
| jpMarineEbsaCoastal | jp-tourism-jp-marine-ebsa-coastal-line | {"width":"keep","opacity":"keep","outline":"coverage"} | {"line-width":1,"line-opacity":"clampOpacity(opacity[key])"} → 1px／0.8／原色 | hookLinePaint／hookLineWidth／hookLineOpacity |
| jpMedicalAreasPrimary | jp-medical-areas-1-fill | background | {"fill-opacity":"clamp(params[keyOpacity] ?? 0.22)"} → fill-opacity 0.15 | hookFillPaint／hookFillOpacity |
| jpMedicalAreasPrimary | jp-medical-areas-1-outline | {"width":"keep","opacity":"keep","outline":"background"} | {"line-width":1,"line-opacity":0.75} → 0.5px／0.6／BOUNDARY_GRAY | hookLinePaint／hookLineWidth／hookLineOpacity |
| jpMedicalAreasSecondary | jp-medical-areas-2-fill | background | {"fill-opacity":"clamp(params[keyOpacity] ?? 0.22)"} → fill-opacity 0.15 | hookFillPaint／hookFillOpacity |
| jpMedicalAreasSecondary | jp-medical-areas-2-outline | {"width":"keep","opacity":"keep","outline":"background"} | {"line-width":1,"line-opacity":0.75} → 0.5px／0.6／BOUNDARY_GRAY | hookLinePaint／hookLineWidth／hookLineOpacity |
| jpMedicalAreasTertiary | jp-medical-areas-3-fill | background | {"fill-opacity":"clamp(params[keyOpacity] ?? 0.22)"} → fill-opacity 0.15 | hookFillPaint／hookFillOpacity |
| jpMedicalAreasTertiary | jp-medical-areas-3-outline | {"width":"keep","opacity":"keep","outline":"background"} | {"line-width":1,"line-opacity":0.75} → 0.5px／0.6／BOUNDARY_GRAY | hookLinePaint／hookLineWidth／hookLineOpacity |
| jpMedicalClinics | jp-medical-facilities-aggregate-fill | graded | {"fill-opacity":"aggregateOpacity(definitions,visibility,params)"} → fill-opacity 0.55 | hookFillPaint／hookFillOpacity |
| jpMedicalClinics | jp-medical-facilities-aggregate-outline | {"width":"keep","opacity":"keep","outline":"graded"} | {"line-width":0.5,"line-opacity":0.4} → 1px／MAP_SEAM／暗0.6淡0.8 | hookLinePaint／hookLineWidth／hookLineOpacity |
| jpMedicalDental | jp-medical-facilities-aggregate-fill | graded | {"fill-opacity":"aggregateOpacity(definitions,visibility,params)"} → fill-opacity 0.55 | hookFillPaint／hookFillOpacity |
| jpMedicalDental | jp-medical-facilities-aggregate-outline | {"width":"keep","opacity":"keep","outline":"graded"} | {"line-width":0.5,"line-opacity":0.4} → 1px／MAP_SEAM／暗0.6淡0.8 | hookLinePaint／hookLineWidth／hookLineOpacity |
| jpMedicalHospitals | jp-medical-facilities-aggregate-fill | graded | {"fill-opacity":"aggregateOpacity(definitions,visibility,params)"} → fill-opacity 0.55 | hookFillPaint／hookFillOpacity |
| jpMedicalHospitals | jp-medical-facilities-aggregate-outline | {"width":"keep","opacity":"keep","outline":"graded"} | {"line-width":0.5,"line-opacity":0.4} → 1px／MAP_SEAM／暗0.6淡0.8 | hookLinePaint／hookLineWidth／hookLineOpacity |
| jpMedicalMaternity | jp-medical-facilities-aggregate-fill | graded | {"fill-opacity":"aggregateOpacity(definitions,visibility,params)"} → fill-opacity 0.55 | hookFillPaint／hookFillOpacity |
| jpMedicalMaternity | jp-medical-facilities-aggregate-outline | {"width":"keep","opacity":"keep","outline":"graded"} | {"line-width":0.5,"line-opacity":0.4} → 1px／MAP_SEAM／暗0.6淡0.8 | hookLinePaint／hookLineWidth／hookLineOpacity |
| jpMedicalPharmacies | jp-medical-facilities-aggregate-fill | graded | {"fill-opacity":"aggregateOpacity(definitions,visibility,params)"} → fill-opacity 0.55 | hookFillPaint／hookFillOpacity |
| jpMedicalPharmacies | jp-medical-facilities-aggregate-outline | {"width":"keep","opacity":"keep","outline":"graded"} | {"line-width":0.5,"line-opacity":0.4} → 1px／MAP_SEAM／暗0.6淡0.8 | hookLinePaint／hookLineWidth／hookLineOpacity |
| jpNaturalParksNational | jp-tourism-jp-natural-parks-national-fill | coverage | {"fill-opacity":"clampOpacity(opacity[key])"} → fill-opacity 0.35 | hookFillPaint／hookFillOpacity |
| jpNaturalParksNational | jp-tourism-jp-natural-parks-national-line | {"width":"keep","opacity":"keep","outline":"coverage"} | {"line-width":1,"line-opacity":"clampOpacity(opacity[key])"} → 1px／0.8／原色 | hookLinePaint／hookLineWidth／hookLineOpacity |
| jpNaturalParksPrefectural | jp-tourism-jp-natural-parks-prefectural-fill | coverage | {"fill-opacity":"clampOpacity(opacity[key])"} → fill-opacity 0.35 | hookFillPaint／hookFillOpacity |
| jpNaturalParksPrefectural | jp-tourism-jp-natural-parks-prefectural-line | {"width":"keep","opacity":"keep","outline":"coverage"} | {"line-width":1,"line-opacity":"clampOpacity(opacity[key])"} → 1px／0.8／原色 | hookLinePaint／hookLineWidth／hookLineOpacity |
| jpNaturalParksQuasiNational | jp-tourism-jp-natural-parks-quasi-national-fill | coverage | {"fill-opacity":"clampOpacity(opacity[key])"} → fill-opacity 0.35 | hookFillPaint／hookFillOpacity |
| jpNaturalParksQuasiNational | jp-tourism-jp-natural-parks-quasi-national-line | {"width":"keep","opacity":"keep","outline":"coverage"} | {"line-width":1,"line-opacity":"clampOpacity(opacity[key])"} → 1px／0.8／原色 | hookLinePaint／hookLineWidth／hookLineOpacity |
| jpNatureConservationArea | jp-tourism-jp-nature-conservation-area-fill | coverage | {"fill-opacity":"clampOpacity(opacity[key])"} → fill-opacity 0.35 | hookFillPaint／hookFillOpacity |
| jpNatureConservationArea | jp-tourism-jp-nature-conservation-area-line | {"width":"keep","opacity":"keep","outline":"coverage"} | {"line-width":1,"line-opacity":"clampOpacity(opacity[key])"} → 1px／0.8／原色 | hookLinePaint／hookLineWidth／hookLineOpacity |
| jpNatureConservationSpecialDistrict | jp-tourism-jp-nature-conservation-special-district-fill | coverage | {"fill-opacity":"clampOpacity(opacity[key])"} → fill-opacity 0.35 | hookFillPaint／hookFillOpacity |
| jpNatureConservationSpecialDistrict | jp-tourism-jp-nature-conservation-special-district-line | {"width":"keep","opacity":"keep","outline":"coverage"} | {"line-width":1,"line-opacity":"clampOpacity(opacity[key])"} → 1px／0.8／原色 | hookLinePaint／hookLineWidth／hookLineOpacity |
| jpPopulationMesh1km | jp-population-mesh-fill | coverage | {"fill-opacity":"opacity"} → fill-opacity 0.35 | hookFillPaint／hookFillOpacity |
| jpPrimitiveNatureEnvironmentArea | jp-tourism-jp-primitive-nature-environment-area-fill | coverage | {"fill-opacity":"clampOpacity(opacity[key])"} → fill-opacity 0.35 | hookFillPaint／hookFillOpacity |
| jpPrimitiveNatureEnvironmentArea | jp-tourism-jp-primitive-nature-environment-area-line | {"width":"keep","opacity":"keep","outline":"coverage"} | {"line-width":1,"line-opacity":"clampOpacity(opacity[key])"} → 1px／0.8／原色 | hookLinePaint／hookLineWidth／hookLineOpacity |
| jpRailways | jp-railways-line | {"width":"emphasis","opacity":"standard"} | {"line-width":"z14=3","line-opacity":"opacity"} → width 2→3.5；opacity .85 | hookLinePaint／hookLineWidth／hookLineOpacity |
| jpWaterLakes | jp-water-jpWaterLakes | coverage | {"fill-opacity":"clamp(opacity)"} → fill-opacity 0.35 | hookFillPaint／hookFillOpacity |
| jpWaterRivers | jp-water-jpWaterRivers | {"width":"standard","opacity":"standard"} | {"line-width":"z14=2","line-opacity":"clamp(opacity)"} → width 1→2；opacity .85 | hookLinePaint／hookLineWidth／hookLineOpacity |
| jpWaterSupplyAreas | jp-water-jpWaterSupplyAreas | background | {"fill-opacity":"clamp(opacity)","fill-outline-color":"#38bdf8"} → fill-opacity 0.15 | hookFillPaint／hookFillOpacity |
| jpWildlifeProtectionNational | jp-tourism-jp-wildlife-protection-national-fill | coverage | {"fill-opacity":"clampOpacity(opacity[key])"} → fill-opacity 0.35 | hookFillPaint／hookFillOpacity |
| jpWildlifeProtectionNational | jp-tourism-jp-wildlife-protection-national-line | {"width":"keep","opacity":"keep","outline":"coverage"} | {"line-width":1,"line-opacity":"clampOpacity(opacity[key])"} → 1px／0.8／原色 | hookLinePaint／hookLineWidth／hookLineOpacity |
| jpWildlifeSpecialProtectionDesignatedArea | jp-tourism-jp-wildlife-special-protection-designated-area-fill | coverage | {"fill-opacity":"clampOpacity(opacity[key])"} → fill-opacity 0.35 | hookFillPaint／hookFillOpacity |
| jpWildlifeSpecialProtectionDesignatedArea | jp-tourism-jp-wildlife-special-protection-designated-area-line | {"width":"keep","opacity":"keep","outline":"coverage"} | {"line-width":1,"line-opacity":"clampOpacity(opacity[key])"} → 1px／0.8／原色 | hookLinePaint／hookLineWidth／hookLineOpacity |
| jpWildlifeSpecialProtectionDistrict | jp-tourism-jp-wildlife-special-protection-district-fill | coverage | {"fill-opacity":"clampOpacity(opacity[key])"} → fill-opacity 0.35 | hookFillPaint／hookFillOpacity |
| jpWildlifeSpecialProtectionDistrict | jp-tourism-jp-wildlife-special-protection-district-line | {"width":"keep","opacity":"keep","outline":"coverage"} | {"line-width":1,"line-opacity":"clampOpacity(opacity[key])"} → 1px／0.8／原色 | hookLinePaint／hookLineWidth／hookLineOpacity |
| jpWorldNaturalHeritageHistorical | jp-tourism-jp-world-natural-heritage-historical-fill | coverage | {"fill-opacity":"clampOpacity(opacity[key])"} → fill-opacity 0.35 | hookFillPaint／hookFillOpacity |
| jpWorldNaturalHeritageHistorical | jp-tourism-jp-world-natural-heritage-historical-line | {"width":"keep","opacity":"keep","outline":"coverage"} | {"line-width":1,"line-opacity":"clampOpacity(opacity[key])"} → 1px／0.8／原色 | hookLinePaint／hookLineWidth／hookLineOpacity |
| lifelineAlerts | lifelineAlerts-fill | keep | {"fill-opacity":"SEVERITY_FILL_OPACITY"} → 保留原 expression | hookFillPaint／hookFillOpacity |
| lifelineAlerts | lifelineAlerts-line | {"width":"standard","opacity":"standard"} | {"line-width":"1.5","line-opacity":"0.9"} → width 1→2；opacity .85 | hookLinePaint／hookLineWidth／hookLineOpacity |
| plaActivity | pla-activity-fill | keep | {"fill-opacity":"fillOpacityExpr(opacity"} → 保留原 expression | hookFillPaint／hookFillOpacity |
| plaActivity | pla-activity-line | {"width":"keep","opacity":"keep"} | {"line-width":"lineWidth(trailDays)","line-opacity":"lineOpacityExpr(opacity","line-dasharray":"LINE_DASH"} → width 保留；opacity 保留 | hookLinePaint／hookLineWidth／hookLineOpacity |
| powerLinesGlow | power-lines-glow-{halo-far,halo-mid,halo-near,core} | 排除 | {"line-width":"paintWidth","line-opacity":"paintOpacity"} → 維持：裝飾／互動／不套階 | — |
| propertyValueAdmin | property-value-admin-county-fill | graded | {"fill-opacity":"opacity","fill-outline-color":"\"rgba(0,0,0,0)\""} → fill-opacity 0.55 | hookFillPaint／hookFillOpacity |
| propertyValueAdmin | property-value-admin-county-line | {"width":"keep","opacity":"keep","outline":"graded"} | {"line-width":"[\"interpolate\", [\"linear\"], [\"zoom\"], config.minzoom, 0.4, 10, 1.1]","line-opacity":"Math.min(1"} → 1px／MAP_SEAM／暗0.6淡0.8 | hookLinePaint／hookLineWidth／hookLineOpacity |
| propertyValueAdmin | property-value-admin-township-fill | graded | {"fill-opacity":"opacity","fill-outline-color":"\"rgba(0,0,0,0)\""} → fill-opacity 0.55 | hookFillPaint／hookFillOpacity |
| propertyValueAdmin | property-value-admin-township-line | {"width":"keep","opacity":"keep","outline":"graded"} | {"line-width":"[\"interpolate\", [\"linear\"], [\"zoom\"], config.minzoom, 0.4, 10, 1.1]","line-opacity":"Math.min(1"} → 1px／MAP_SEAM／暗0.6淡0.8 | hookLinePaint／hookLineWidth／hookLineOpacity |
| roadCongestion | road-congestion-hit | 排除 | {"line-width":"12","line-opacity":"0"} → 維持：裝飾／互動／不套階 | — |
| roadCongestion | road-congestion-line | {"width":"emphasis","opacity":"standard"} | {"line-width":"widthExpr(width)","line-opacity":"opacity"} → width 2→3.5；opacity .85 | hookLinePaint／hookLineWidth／hookLineOpacity |
| roadEvents | roadEvents-fill | graded | {"fill-opacity":"0.22"} → fill-opacity 0.55 | hookFillPaint／hookFillOpacity |
| roadEvents | roadEvents-line | {"width":"standard","opacity":"standard"} | {"line-width":"2","line-opacity":"0.9"} → width 1→2；opacity .85 | hookLinePaint／hookLineWidth／hookLineOpacity |
| safetyAlerts | safetyAlerts-fill | keep | {"fill-opacity":"SEVERITY_FILL_OPACITY"} → 保留原 expression | hookFillPaint／hookFillOpacity |
| safetyAlerts | safetyAlerts-line | {"width":"standard","opacity":"standard"} | {"line-width":"1.5","line-opacity":"0.9"} → width 1→2；opacity .85 | hookLinePaint／hookLineWidth／hookLineOpacity |
| satellitesYaogan | sat-footprint-inner | coverage | {"fill-opacity":"0.35","fill-outline-color":"COLOR_EXPR"} → fill-opacity 0.35 | hookFillPaint／hookFillOpacity |
| satellitesYaogan | sat-footprint-outer | {"width":"thin","opacity":"reference"} | {"line-width":"1","line-opacity":"0.35","line-dasharray":"[3, 3]"} → width .5→1；opacity .6 | hookLinePaint／hookLineWidth／hookLineOpacity |
| satellitesYaogan | sat-track | {"width":"standard","opacity":"reference"} | {"line-width":"1.4","line-opacity":"0.5"} → width 1→2；opacity .6 | hookLinePaint／hookLineWidth／hookLineOpacity |
| slopeVector | slope-vector-fill | coverage | {"fill-opacity":"opacity"} → fill-opacity 0.35 | hookFillPaint／hookFillOpacity |
| soilLiquefactionPotential | soil-liquefaction-potential-fill | coverage | {"fill-opacity":"opacity.soilLiquefactionPotential"} → fill-opacity 0.35 | hookFillPaint／hookFillOpacity |
| soilLiquefactionPotential | soil-liquefaction-potential-not-investigated | coverage | {"fill-opacity":"opacity.soilLiquefactionPotential"} → fill-opacity 0.35 | hookFillPaint／hookFillOpacity |
| soilLiquefactionPotential | soil-liquefaction-potential-outline | {"width":"thin","opacity":"reference"} | {"line-width":0.5,"line-opacity":"GRADED_SEAM"} → width .5→1；opacity .6 | hookLinePaint／hookLineWidth／hookLineOpacity |
| transitAlerts | transitAlerts-fill | keep | {"fill-opacity":"SEVERITY_FILL_OPACITY"} → 保留原 expression | hookFillPaint／hookFillOpacity |
| transitAlerts | transitAlerts-line | {"width":"standard","opacity":"standard"} | {"line-width":"1.5","line-opacity":"0.9"} → width 1→2；opacity .85 | hookLinePaint／hookLineWidth／hookLineOpacity |
| typhoonTracks | typhoon-tracks-line-forecast | {"width":"standard","opacity":"reference"} | {"line-width":"[\"interpolate\", [\"linear\"], [\"zoom\"], 3, 1, 8, 2] as unknown as ExpressionSpecification","line-opacity":"0.8","line-dasharray":"[1, 2.5]"} → width 1→2；opacity .6 | hookLinePaint／hookLineWidth／hookLineOpacity |
| typhoonTracks | typhoon-tracks-line-observed | {"width":"emphasis","opacity":"standard"} | {"line-width":"[\"interpolate\", [\"linear\"], [\"zoom\"], 3, 2, 8, 4.5] as unknown as ExpressionSpecification","line-opacity":"0.95"} → width 2→3.5；opacity .85 | hookLinePaint／hookLineWidth／hookLineOpacity |
| vesselWatch | vessel-watch-trail-line | {"width":"standard","opacity":"reference"} | {"line-width":"1.4","line-opacity":"opacity * TRAIL_OPACITY_RATIO"} → width 1→2；opacity .6 | hookLinePaint／hookLineWidth／hookLineOpacity |
| weakSoilClay0To5 | soil-liquefaction-weakSoilClay0To5-fill | coverage | {"fill-opacity":"opacity.weakSoilClay0To5"} → fill-opacity 0.35 | hookFillPaint／hookFillOpacity |
| weakSoilClay0To5 | soil-liquefaction-weakSoilClay0To5-missing | coverage | {"fill-opacity":"opacity.weakSoilClay0To5"} → fill-opacity 0.35 | hookFillPaint／hookFillOpacity |
| weakSoilClay10To20 | soil-liquefaction-weakSoilClay10To20-fill | coverage | {"fill-opacity":"opacity.weakSoilClay10To20"} → fill-opacity 0.35 | hookFillPaint／hookFillOpacity |
| weakSoilClay10To20 | soil-liquefaction-weakSoilClay10To20-missing | coverage | {"fill-opacity":"opacity.weakSoilClay10To20"} → fill-opacity 0.35 | hookFillPaint／hookFillOpacity |
| weakSoilClay5To10 | soil-liquefaction-weakSoilClay5To10-fill | coverage | {"fill-opacity":"opacity.weakSoilClay5To10"} → fill-opacity 0.35 | hookFillPaint／hookFillOpacity |
| weakSoilClay5To10 | soil-liquefaction-weakSoilClay5To10-missing | coverage | {"fill-opacity":"opacity.weakSoilClay5To10"} → fill-opacity 0.35 | hookFillPaint／hookFillOpacity |
| weakSoilSand0To5 | soil-liquefaction-weakSoilSand0To5-fill | coverage | {"fill-opacity":"opacity.weakSoilSand0To5"} → fill-opacity 0.35 | hookFillPaint／hookFillOpacity |
| weakSoilSand0To5 | soil-liquefaction-weakSoilSand0To5-missing | coverage | {"fill-opacity":"opacity.weakSoilSand0To5"} → fill-opacity 0.35 | hookFillPaint／hookFillOpacity |
| weakSoilSand10To20 | soil-liquefaction-weakSoilSand10To20-fill | coverage | {"fill-opacity":"opacity.weakSoilSand10To20"} → fill-opacity 0.35 | hookFillPaint／hookFillOpacity |
| weakSoilSand10To20 | soil-liquefaction-weakSoilSand10To20-missing | coverage | {"fill-opacity":"opacity.weakSoilSand10To20"} → fill-opacity 0.35 | hookFillPaint／hookFillOpacity |
| weakSoilSand5To10 | soil-liquefaction-weakSoilSand5To10-fill | coverage | {"fill-opacity":"opacity.weakSoilSand5To10"} → fill-opacity 0.35 | hookFillPaint／hookFillOpacity |
| weakSoilSand5To10 | soil-liquefaction-weakSoilSand5To10-missing | coverage | {"fill-opacity":"opacity.weakSoilSand5To10"} → fill-opacity 0.35 | hookFillPaint／hookFillOpacity |
| weatherAlerts | weatherAlerts-fill | keep | {"fill-opacity":"SEVERITY_FILL_OPACITY"} → 保留原 expression | hookFillPaint／hookFillOpacity |
| weatherAlerts | weatherAlerts-line | {"width":"standard","opacity":"standard"} | {"line-width":"1.5","line-opacity":"0.9"} → width 1→2；opacity .85 | hookLinePaint／hookLineWidth／hookLineOpacity |
| agriculture | agri-ftw-fields-fill | keep | {"fill-opacity":"confidence_mean interpolate × agricultureOpacity","fill-outline-color":"fixed green"} → 保留原 expression | hookFillPaint／hookFillOpacity |
| agriculture | agri-ftw-fields-outline | {"width":"thin","opacity":"reference"} | {"line-width":"z14=.8 × agricultureOutlineWidth","line-opacity":0.55} → width .5→1；opacity .6 | hookLinePaint／hookLineWidth／hookLineOpacity |
| agriSoil | agri-soil-fill | coverage | {"fill-opacity":".35 × slider","fill-outline-color":"fixed"} → fill-opacity 0.35 | hookFillPaint／hookFillOpacity |
| agriSoilFertility | agri-soil-fertility-fill | graded | {"fill-opacity":".7 × slider"} → fill-opacity 0.55 | hookFillPaint／hookFillOpacity |
| agriLeisureFarmZones | agri-leisure-farm-zones-fill | coverage | {"fill-opacity":".3 × slider"} → fill-opacity 0.35 | hookFillPaint／hookFillOpacity |
| agriRuralRegen | agri-rural-regen-fill | coverage | {"fill-opacity":".3 × slider"} → fill-opacity 0.35 | hookFillPaint／hookFillOpacity |
| agriCropSuitability | agri-crop-suitability-fill | graded | {"fill-opacity":".45 × slider"} → fill-opacity 0.55 | hookFillPaint／hookFillOpacity |
| fireIsochrone | fire-isochrone-coverage-fill | graded | {"fill-opacity":".45 × .5"} → fill-opacity 0.55 | hookFillPaint／hookFillOpacity |
| medIsochrone | medical-isochrone-fill | graded | {"fill-opacity":".45 × .5"} → fill-opacity 0.55 | hookFillPaint／hookFillOpacity |
| temperatureGrid | temperature-grid-fill | keep | {"fill-opacity":"case feature-state temp missing→0 else tempGridOpacity"} → 保留原 expression | hookFillPaint／hookFillOpacity |
| earthquakeReplay | eq-replay-grid-fill | keep | {"fill-opacity":"feature-state lit × replay opacity"} → 保留原 expression | hookFillPaint／hookFillOpacity |
| earthquakeReplay | eq-replay-town-fill | keep | {"fill-opacity":"feature-state town fade","fill-outline-color":"fixed"} → 保留原 expression | hookFillPaint／hookFillOpacity |
| h3Population | h3-population-fill | graded | {"fill-opacity":"h3Opacity"} → fill-opacity 0.55 | hookFillPaint／hookFillOpacity |
| popCount | h3-pop-count-fill | graded | {"fill-opacity":"pcOpacity"} → fill-opacity 0.55 | hookFillPaint／hookFillOpacity |
| indicators | h3-indicators-fill | graded | {"fill-opacity":"indOpacity"} → fill-opacity 0.55 | hookFillPaint／hookFillOpacity |
| socioeconomic | h3-socio-fill | graded | {"fill-opacity":"socioOpacity"} → fill-opacity 0.55 | hookFillPaint／hookFillOpacity |
| spatialEconomy | h3-spatial-fill | graded | {"fill-opacity":"spatialOpacity"} → fill-opacity 0.55 | hookFillPaint／hookFillOpacity |
| youbikeFullness | h3-youbike-fill | graded | {"fill-opacity":"ybOpacity"} → fill-opacity 0.55 | hookFillPaint／hookFillOpacity |
| rail | rail-tracks-line | {"width":"emphasis","opacity":"standard"} | {"line-width":["interpolate",["linear"],["zoom"],6,1,10,2.5,13,4,16,7],"line-opacity":"dark .75/light .6"} → width 2→3.5；opacity .85 | hookLinePaint／hookLineWidth／hookLineOpacity |
| flights | static-trails-line | {"width":"thin","opacity":"reference"} | {"line-width":1,"line-opacity":"dark .25/light .5"} → width .5→1；opacity .6 | hookLinePaint／hookLineWidth／hookLineOpacity |
| medDesert | medical-isochrone-fill | graded | {"fill-opacity":".45 × .5"} → fill-opacity 0.55 | hookFillPaint／hookFillOpacity |

A 值核對補充：Drone 真正 slider default 為 .45（line 原預設 .75）；GFW fishing 為 .58；颱風 observed/forecast 實際 runtime 原 opacity 為 .81/.63。GlobalEvents 關聯線 initial 套階，runtime width/opacity 依 selected event 的 expression 保留。PLA age、GFW 軌跡狀態、洪水／災害狀態與航空限制区 data encoding 保留。H3 原始高度值沒有除以 50/80。

## B：14 層全部維持

| layer | 語意與依據 | 本輪行為 |
|---|---|---|
| companyAgeStructure | 0 是有效占比或中位數；缺值/無效值為 -1 neutral，不能混同。；`src/map/overlayRegistry.ts` | 維持既有 source/filter/paint 判定，不新增 0 filter／hatch |
| companyCapitalGrid | 資產為 occupied-only/non-empty 格網；capital_median=null 維持 neutral，不可視為 0。；`src/map/overlayRegistry.ts` | 維持既有 source/filter/paint 判定，不新增 0 filter／hatch |
| companyIndustryDistribution | 選定群組加總=0 已透明；缺欄位為負 sentinel 的 neutral，不能新增通用 filter。；`src/map/overlayRegistry.ts` | 維持既有 source/filter/paint 判定，不新增 0 filter／hatch |
| companyPoints | overview 重用 occupied-only 公司資本額格網；空白 source cell 不會成為 feature，缺 n_companies 維持 neutral。；`src/map/overlayRegistry.ts` | 維持既有 source/filter/paint 判定，不新增 0 filter／hatch |
| factoryDensityGrid | 量的是可定位 records；未證明 0 是完整無實體 cell，維持 coverage 語意。；`src/map/overlayRegistry.ts` | 維持既有 source/filter/paint 判定，不新增 0 filter／hatch |
| jpBuildingHeight | 0 是合法平面高度；null/缺值/負 sentinel 維持中性平面。；`src/map/overlayRegistry.ts` | 維持既有 source/filter/paint 判定，不新增 0 filter／hatch |
| manufacturingCompanyDensityGrid | 量的是可定位 records；未證明 0 是完整無實體 cell，維持 coverage 語意。；`src/map/overlayRegistry.ts` | 維持既有 source/filter/paint 判定，不新增 0 filter／hatch |
| noiseCaptureGrid | 留白是無樣本通過品質 gate，不是安靜或 0 dB；provisional 另有編碼。；`src/map/overlayRegistry.ts` | 維持既有 source/filter/paint 判定，不新增 0 filter／hatch |
| propertyValueGrid | 零值依 mode 不同：總市值 v_mkt=0 淡出；人均 pop>=10、v_mkt=0 是有效 0；pop<10 是不確定性。；`src/map/overlayRegistry.ts` | 維持既有 source/filter/paint 判定，不新增 0 filter／hatch |
| realEstatePresaleGrid | 本 worktree 無 PMTiles payload，無法確認價格或交易零值語意，不可猜測。；`src/map/overlayRegistry.ts` | 維持既有 source/filter/paint 判定，不新增 0 filter／hatch |
| realEstateRentalGrid | 本 worktree 無 PMTiles payload，無法確認價格或交易零值語意，不可猜測。；`src/map/overlayRegistry.ts` | 維持既有 source/filter/paint 判定，不新增 0 filter／hatch |
| realEstateSaleGrid | 本 worktree 無 PMTiles payload，無法確認價格或交易零值語意，不可猜測。；`src/map/overlayRegistry.ts` | 維持既有 source/filter/paint 判定，不新增 0 filter／hatch |
| regulatedFacilityDensityGrid | 量的是可定位 records；未證明 0 是完整無實體 cell，維持 coverage 語意。；`src/map/overlayRegistry.ts` | 維持既有 source/filter/paint 判定，不新增 0 filter／hatch |
| urbanFormGrid | 不同 mode 的 0 不同：建物欄位可淡出、canopy_pct=0 是觀測零、gg_index 有正負；無 hatch 依據。；`src/map/overlayRegistry.ts` | 維持既有 source/filter/paint 判定，不新增 0 filter／hatch |

## C：影像

| layer | 分類／改前 → 改後 |
|---|---|
| urbanHeat | {"minzoom":6,"maxzoom":11,"paint":{"raster-opacity":"urbanHeatOpacity ?? 0.75","raster-resampling":"nearest","raster-fade-duration":0,"raster-color":"data-derived mode palette"}} → {"resampling":"nearest","fadeZero":true,"opacity":0.7}；default .7，slider .3–1 |
| canopyHeight | {"minzoom":6,"maxzoom":12,"paint":{"raster-opacity":"canopyHeightOpacity ?? 0.7","raster-resampling":"nearest","raster-color":"R channel metres; 0/nodata transparent"}} → {"resampling":"nearest","fadeZero":false,"opacity":0.7}；default .7，slider .3–1 |
| jpCanopyHeight | {"minzoom":9,"maxzoom":12,"paint":{"raster-opacity":"jpCanopyHeightOpacity ?? 0.7","raster-resampling":"nearest","raster-color":"R channel metres; pilot coverage"}} → {"resampling":"nearest","fadeZero":false,"opacity":0.7}；default .7，slider .3–1 |
| dustForecast | {"minzoom":null,"paint":{"raster-opacity":"dustForecastOpacity","raster-resampling":"linear","raster-fade-duration":0}} → {"resampling":"nearest","fadeZero":true,"opacity":0.7}；default .7，slider .3–1 |
| jpWaterFloodHazard | {"minzoom":2,"maxzoom":17,"paint":{"raster-opacity":"clamp(jpWaterFloodHazardOpacity)","raster-resampling":null,"raster-fade-duration":null}} → {"resampling":"nearest","fadeZero":false,"opacity":0.7}；default .7，slider .3–1 |
| cwaCloudImagery | {"minzoom":null,"paint":{"raster-opacity":"cwaCloudOpacity","raster-resampling":null,"raster-fade-duration":0}} → {"resampling":"linear","fadeZero":true,"opacity":0.7}；default .7，slider .3–1 |
| cwaRadarImagery | {"minzoom":null,"paint":{"raster-opacity":"cwaRadarOpacity","raster-resampling":null,"raster-fade-duration":0}} → {"resampling":"nearest","fadeZero":true,"opacity":0.7}；default .7，slider .3–1 |
| aqiImagery | {"minzoom":null,"paint":{"raster-opacity":"aqiImageryOpacity","raster-resampling":null,"raster-fade-duration":0}} → {"resampling":"nearest","fadeZero":true,"opacity":0.7}；default .7，slider .3–1 |
| precipRaster | {"minzoom":null,"paint":{"raster-opacity":"precipRasterOpacity","raster-resampling":null,"raster-fade-duration":0}} → {"resampling":"nearest","fadeZero":true,"opacity":0.7}；default .7，slider .3–1 |

照片／雲圖 linear；量測影像 nearest；時間序列換幀 fade 0。九層 params 與 host fallback 引用 `RASTER`。

## D：文字（使用者修正版）

| layer | 改前 → 改後 |
|---|---|
| noiseCapture | 第一段誤列，無 count symbol；newsEvents/count 恢復原樣，不擴張範圍 |
| gfwHourlyGrid | minzoom 保留；vessel_count step 10／11／12 保留；Bold、halo 1.25、overlap true；包含目前／下一幀兩子層 |
| globalEvents | minzoom 保留；固定 11 → z10 11／z14 13 Bold、halo 1.25，overlap true |
| aqiMicroSensors | minzoom 保留；固定 11 → z10 11／z14 13 Bold、halo 1.25，overlap true；theme 僅 paint |
| publicToilets | minzoom 16 維持；POI 字級 z10 10／z14 12、halo 1.25、overlap false |
| publicWasteBaskets | minzoom 15 維持，其餘同 POI |
| materialRecyclingPoints | minzoom 14 維持，其餘同 POI |
| playgrounds | minzoom 14 維持，其餘同 POI |
| visitorCentres | minzoom 10 → 13，其餘同 POI |

## E：擠出

| layer | 改前 → 改後 |
|---|---|
| propertyValueGrid | {"fill-extrusion-opacity":"extruded ? propertyValueGridOpacity ?? 0.7 : 0","fill-extrusion-height":"propertyValueGridHeightExpr(scale, contrast ??1.8, elevationScale ??40)","fill-extrusion-vertical-gradient":null} → opacity .85（原滑桿比例，clamp 1），gradient true；高度 UI default 1 × 原基準 40，保留物理高度 |
| buildingsGba | {"fill-extrusion-opacity":"modeIdx===2 ? buildingsGbaOpacity ??0.75 : 0","fill-extrusion-height":"coalesce(get(h),3)","fill-extrusion-vertical-gradient":null} → opacity .85（原滑桿比例，clamp 1），gradient true；無既有高度滑桿，物理高度維持 |
| jpBuildingHeight | {"fill-extrusion-opacity":"modeIdx===1 ? jpBuildingHeightOpacity ??0.75 : 0","fill-extrusion-height":"get(height); filter valid numeric height","fill-extrusion-vertical-gradient":null} → opacity .85（原滑桿比例，clamp 1），gradient true；無既有高度滑桿，物理高度維持 |
| h3Population | {"fill-extrusion-opacity":"h3Opacity; init 0.6","fill-extrusion-height":"get(height) * h3ElevationScale *100; init uses 5000","fill-extrusion-vertical-gradient":null} → opacity .85（原滑桿比例，clamp 1），gradient true；高度 UI default 1 × 原基準 50，保留物理高度 |
| popCount | {"fill-extrusion-opacity":"pcOpacity; init 0.6","fill-extrusion-height":"get(height) * pcElevationScale *100; init uses 5000","fill-extrusion-vertical-gradient":null} → opacity .85（原滑桿比例，clamp 1），gradient true；高度 UI default 1 × 原基準 50，保留物理高度 |
| indicators | {"fill-extrusion-opacity":"indOpacity; init 0.6","fill-extrusion-height":"get(height) * indElevationScale *100","fill-extrusion-vertical-gradient":null} → opacity .85（原滑桿比例，clamp 1），gradient true；高度 UI default 1 × 原基準 50，保留物理高度 |
| socioeconomic | {"fill-extrusion-opacity":"socioOpacity; init 0.6","fill-extrusion-height":"get(height) * socioElevation *100","fill-extrusion-vertical-gradient":null} → opacity .85（原滑桿比例，clamp 1），gradient true；高度 UI default 1 × 原基準 50，保留物理高度 |
| spatialEconomy | {"fill-extrusion-opacity":"spatialOpacity; init 0.6","fill-extrusion-height":"get(height) * spatialElevation *100","fill-extrusion-vertical-gradient":null} → opacity .85（原滑桿比例，clamp 1），gradient true；高度 UI default 1 × 原基準 50，保留物理高度 |
| youbikeFullness | {"fill-extrusion-opacity":"ybOpacity; init 0.6","fill-extrusion-height":"get(height) * ybElevationScale *100; init 5000","fill-extrusion-vertical-gradient":null} → opacity .85（原滑桿比例，clamp 1），gradient true；高度 UI default 1 × 原基準 80，保留物理高度 |

## 圖例與樣式更新

- PropertyValueAdmin 改用方形色票，外框與地圖共用 `mapSeamColor`。
- 日本醫療低縮放網格色票描邊共用 `mapSeamColor`；醫療圈描邊共用 `BOUNDARY_GRAY`。其他資料色票／類別配色未變。
- BuildingsGba 原 `rebuildOnParamChange` 對任何 paint 改動都重建子層，瀏覽器每輪透明度測試觀測到 18 個 PMTiles 請求。新增明確的重建參數設定，只讓高度門檻觸發重建，opacity／theme／mode 只更新 paint；其他 config 原行為保留。
- 主題／透明度不加入資料 fetch 依賴。Rail／Flights 依 source 與資料 identity 避免樣式更新重送 geometry；醫療 aggregate memo 僅依資料與有效分類；MicroSensors／GlobalEvents theme 只 paint。Flood sensor async 以 opacityRef 避免資料回來時寫回舊滑桿值。

## 保留與待驗收項目

- 缺值／抑制／未調查區域、資料色／寬／dash／透明度、source、geometry precision、filter、popup 均保留；earthquake replay 的 fill-outline-color 移除，不改 replay/state opacity。
- 開發機無法逐層取得的即時／日本／受限資料，不能由 TypeScript、helper tests 或 mock 判為視覺通過；除比較頁中有資料的樣本外，其餘待正式站目視。
- 本 PR 不表示已 merge、部署或正式站驗收；完成後由 Claude 依 handoff §7/§8 驗收。
- 高度 slider 沿用既有參數名但单位正規化為倍率；舊分享網址若明寫原 40／50／80 參數，需重設高度到 1。未改 URL schema 或猜測遷移舊值。

## 黃金快照逐屬性差異

共 88 個 leaf 屬性差異（array 長度變動以整段列出）；只落在確認版 C／D／E 與高度參數。關閉中的 extrusion opacity 仍為 0，啟用後 .85 由契約測試與瀏覽器另驗。

| 定位 | 屬性 | 改前 | 改後 |
|---|---|---|---|
| urbanHeat (urban-heat-lst) | `/overlays/0/layers/0/paint/dark/raster-opacity` | `0.75` | `0.7` |
| urbanHeat (urban-heat-lst) | `/overlays/0/layers/0/paint/light/raster-opacity` | `0.75` | `0.7` |
| publicToilets (public-toilets) | `/overlays/49/layers/2/layout/text-allow-overlap` | `null` | `false` |
| publicToilets (public-toilets) | `/overlays/49/layers/2/layout/text-size/3` | `14` | `10` |
| publicToilets (public-toilets) | `/overlays/49/layers/2/layout/text-size/5` | `17` | `14` |
| publicToilets (public-toilets) | `/overlays/49/layers/2/layout/text-size/6` | `13` | `12` |
| buildingsGba (buildings-gba) | `/overlays/122/layers/1/paint/dark/fill-extrusion-vertical-gradient` | `null` | `true` |
| buildingsGba (buildings-gba) | `/overlays/122/layers/1/paint/light/fill-extrusion-vertical-gradient` | `null` | `true` |
| jpBuildingHeight (jp-building-height) | `/overlays/124/layers/1/paint/dark/fill-extrusion-vertical-gradient` | `null` | `true` |
| jpBuildingHeight (jp-building-height) | `/overlays/124/layers/1/paint/light/fill-extrusion-vertical-gradient` | `null` | `true` |
| propertyValueGrid (property-value-grid-150) | `/overlays/125/layers/1/paint/dark/fill-extrusion-vertical-gradient` | `null` | `true` |
| propertyValueGrid (property-value-grid-150) | `/overlays/125/layers/1/paint/light/fill-extrusion-vertical-gradient` | `null` | `true` |
| propertyValueGrid (property-value-grid-450) | `/overlays/126/layers/1/paint/dark/fill-extrusion-vertical-gradient` | `null` | `true` |
| propertyValueGrid (property-value-grid-450) | `/overlays/126/layers/1/paint/light/fill-extrusion-vertical-gradient` | `null` | `true` |
| propertyValueGrid (property-value-grid-1500) | `/overlays/127/layers/1/paint/dark/fill-extrusion-vertical-gradient` | `null` | `true` |
| propertyValueGrid (property-value-grid-1500) | `/overlays/127/layers/1/paint/light/fill-extrusion-vertical-gradient` | `null` | `true` |
| publicWasteBaskets (public-waste-baskets) | `/overlays/309/layers/2/layout/text-allow-overlap` | `null` | `false` |
| publicWasteBaskets (public-waste-baskets) | `/overlays/309/layers/2/layout/text-size/3` | `12` | `10` |
| publicWasteBaskets (public-waste-baskets) | `/overlays/309/layers/2/layout/text-size/5` | `16` | `14` |
| publicWasteBaskets (public-waste-baskets) | `/overlays/309/layers/2/layout/text-size/6` | `13` | `12` |
| materialRecyclingPoints (material-recycling-points) | `/overlays/310/layers/2/layout/text-allow-overlap` | `null` | `false` |
| materialRecyclingPoints (material-recycling-points) | `/overlays/310/layers/2/layout/text-size/3` | `12` | `10` |
| materialRecyclingPoints (material-recycling-points) | `/overlays/310/layers/2/layout/text-size/5` | `16` | `14` |
| materialRecyclingPoints (material-recycling-points) | `/overlays/310/layers/2/layout/text-size/6` | `13` | `12` |
| playgrounds (playgrounds) | `/overlays/312/layers/2/layout/text-allow-overlap` | `null` | `false` |
| playgrounds (playgrounds) | `/overlays/312/layers/2/layout/text-size/3` | `12` | `10` |
| playgrounds (playgrounds) | `/overlays/312/layers/2/layout/text-size/5` | `16` | `14` |
| playgrounds (playgrounds) | `/overlays/312/layers/2/layout/text-size/6` | `13` | `12` |
| visitorCentres (visitor-centres) | `/overlays/316/layers/2/layout/text-allow-overlap` | `null` | `false` |
| visitorCentres (visitor-centres) | `/overlays/316/layers/2/layout/text-size/3` | `12` | `10` |
| visitorCentres (visitor-centres) | `/overlays/316/layers/2/layout/text-size/5` | `16` | `14` |
| visitorCentres (visitor-centres) | `/overlays/316/layers/2/layout/text-size/6` | `13` | `12` |
| visitorCentres (visitor-centres) | `/overlays/316/layers/2/minzoom` | `10` | `13` |
| aqiImagery | `/params/aqiImagery/0/min` | `0.1` | `0.3` |
| cwaCloudImagery | `/params/cwaCloudImagery/0/label` | `"透明度 1.00"` | `"透明度 0.70"` |
| cwaCloudImagery | `/params/cwaCloudImagery/0/min` | `0` | `0.3` |
| cwaCloudImagery | `/params/cwaCloudImagery/0/value` | `1` | `0.7` |
| cwaCloudImagery | `/params/cwaCloudImagery/0/valueText` | `"1.00"` | `"0.70"` |
| cwaRadarImagery | `/params/cwaRadarImagery/0/label` | `"透明度 0.85"` | `"透明度 0.70"` |
| cwaRadarImagery | `/params/cwaRadarImagery/0/min` | `0` | `0.3` |
| cwaRadarImagery | `/params/cwaRadarImagery/0/value` | `0.85` | `0.7` |
| cwaRadarImagery | `/params/cwaRadarImagery/0/valueText` | `"0.85"` | `"0.70"` |
| dustForecast | `/params/dustForecast/0/min` | `0` | `0.3` |
| h3Population | `/params/h3Population/3/label` | `"高度 50"` | `"高度 1.00"` |
| h3Population | `/params/h3Population/3/max` | `200` | `4` |
| h3Population | `/params/h3Population/3/min` | `10` | `0.2` |
| h3Population | `/params/h3Population/3/step` | `10` | `0.2` |
| h3Population | `/params/h3Population/3/value` | `50` | `1` |
| h3Population | `/params/h3Population/3/valueText` | `"50"` | `"1.00"` |
| indicators | `/params/indicators/5/label` | `"高度 50"` | `"高度 1.00"` |
| indicators | `/params/indicators/5/max` | `200` | `4` |
| indicators | `/params/indicators/5/min` | `10` | `0.2` |
| indicators | `/params/indicators/5/step` | `10` | `0.2` |
| indicators | `/params/indicators/5/value` | `50` | `1` |
| indicators | `/params/indicators/5/valueText` | `"50"` | `"1.00"` |
| jpWaterFloodHazard | `/params/jpWaterFloodHazard/0/min` | `0.1` | `0.3` |
| popCount | `/params/popCount/3/label` | `"高度 50"` | `"高度 1.00"` |
| popCount | `/params/popCount/3/max` | `200` | `4` |
| popCount | `/params/popCount/3/min` | `10` | `0.2` |
| popCount | `/params/popCount/3/step` | `10` | `0.2` |
| popCount | `/params/popCount/3/value` | `50` | `1` |
| popCount | `/params/popCount/3/valueText` | `"50"` | `"1.00"` |
| precipRaster | `/params/precipRaster/0/label` | `"透明度 0.60"` | `"透明度 0.70"` |
| precipRaster | `/params/precipRaster/0/min` | `0.1` | `0.3` |
| precipRaster | `/params/precipRaster/0/value` | `0.6` | `0.7` |
| precipRaster | `/params/precipRaster/0/valueText` | `"0.60"` | `"0.70"` |
| socioeconomic | `/params/socioeconomic/5/label` | `"高度 50"` | `"高度 1.00"` |
| socioeconomic | `/params/socioeconomic/5/max` | `200` | `4` |
| socioeconomic | `/params/socioeconomic/5/min` | `10` | `0.2` |
| socioeconomic | `/params/socioeconomic/5/step` | `10` | `0.2` |
| socioeconomic | `/params/socioeconomic/5/value` | `50` | `1` |
| socioeconomic | `/params/socioeconomic/5/valueText` | `"50"` | `"1.00"` |
| spatialEconomy | `/params/spatialEconomy/5/label` | `"高度 50"` | `"高度 1.00"` |
| spatialEconomy | `/params/spatialEconomy/5/max` | `200` | `4` |
| spatialEconomy | `/params/spatialEconomy/5/min` | `10` | `0.2` |
| spatialEconomy | `/params/spatialEconomy/5/step` | `10` | `0.2` |
| spatialEconomy | `/params/spatialEconomy/5/value` | `50` | `1` |
| spatialEconomy | `/params/spatialEconomy/5/valueText` | `"50"` | `"1.00"` |
| urbanHeat | `/params/urbanHeat/1/label` | `"透明度 0.75"` | `"透明度 0.70"` |
| urbanHeat | `/params/urbanHeat/1/min` | `0.2` | `0.3` |
| urbanHeat | `/params/urbanHeat/1/value` | `0.75` | `0.7` |
| urbanHeat | `/params/urbanHeat/1/valueText` | `"0.75"` | `"0.70"` |
| youbikeFullness | `/params/youbikeFullness/5/label` | `"高度 80"` | `"高度 1.000"` |
| youbikeFullness | `/params/youbikeFullness/5/max` | `200` | `2.5` |
| youbikeFullness | `/params/youbikeFullness/5/min` | `10` | `0.125` |
| youbikeFullness | `/params/youbikeFullness/5/step` | `10` | `0.125` |
| youbikeFullness | `/params/youbikeFullness/5/value` | `80` | `1` |
| youbikeFullness | `/params/youbikeFullness/5/valueText` | `"80"` | `"1.000"` |
