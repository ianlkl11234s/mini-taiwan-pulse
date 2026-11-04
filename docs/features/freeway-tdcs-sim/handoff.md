# Handoff — 雙北國道逐車模擬 freewayTdcsSim（下游視角）

> **上游 SSOT**：`../../../taipei-gis-analytics/docs/topic-research/freeway_tdcs/_status.md`（研究狀態、模擬規則、已知限制）
> 與 `../../../taipei-gis-analytics/pipelines/analysis/freeway_tdcs/README.md`（pipeline）。
>
> 本檔只放**前端接線簡表 + 上下游差異點**，契約細節不重複寫。

## 上游登記

| 位置 | dataset_id |
|---|---|
| analytics `docs/data-catalog/transportation/freeway_tdcs_sim.md`（#286） | `freeway_tdcs_sim` |
| analytics data-registry 條目 | `transportation.freeway_tdcs_sim` |
| pulse-data registry（#55） | `freeway_tdcs_sim` |

Pulse manifest 依慣例用不帶主題的 id：`upstream.status = "pulse_only"`、`derivedFromDatasets: ["freeway_tdcs_sim"]`、`derivationType: "custom"`。
資料來源總覽顯示「交通部高速公路局『交通資料庫』TDCS M06A」與推算說明（`processing`／`note`）。

## 資料與推算口徑

- 原始資料：交通部高速公路局「交通資料庫」TDCS M06A（各類車種旅次路徑原始資料），2026-09-28 16:00–18:00，雙北國道範圍約 13 萬趟。
- **真實**：各車通過門架的時間。
- **推算**：門架之間的位置（沿國道線形等速內插）、車速、車道與換道（規則分配，換道 2.5 秒橫移）、上下匝道時間。
- 匝道路網來自 OSM。狀態：DISPLAY_ONLY（尚未入分析倉庫）。

## 產物路徑（R2 模擬資料包，ADR-0025）

- CDN：`https://data.itsmigu.com/sim/v1/freeway_tdcs/current.json` → `<ver>/bundle.json`（schema `pulse-sim-bundle-v1`，files[] 帶 bytes／sha256）
- 目前版本 `20261103-1`：共用檔 `meta.json`、`network.json`、`segs.bin`、`trips.bin`，加上 25 個 300 秒時段檔與 1 個前置時段檔，合計約 45.5 MB；首次載入約 8 MB。
- 產生：`scripts/preprocess/build-freeway-tdcs-sim-bundle.py`（讀 analytics 輸出，寫到 gitignored 的 `public/freeway_tdcs/sim/`）；驗證：`scripts/preprocess/verify-freeway-tdcs-sim-bundle.ts`（逐車位置與未切檔版比對）。
- 發布：pulse-data `scripts/publish_sim_bundle.py --slug freeway_tdcs`；退版用 `--rollback <ver>` 改指標，前端不用改。

## 前端接線位置

- Loader：`src/data/freewayTdcsSimLoader.ts`（CDN 優先，DEV 退回本機副本；`withLoading` 掛 loadingRegistry）
- 解碼／合併：`src/data/freewayTdcsSimModel.ts`
- Hook：`src/hooks/useFreewayTdcsSimLayer.ts`（timeStore.subscribe 依時間載時段檔，不進 React deps）
- Custom layer：`src/map/freewayTdcsSimCustomLayer.ts`
- 面板：`src/components/sidebar/layerCatalog.ts` 模擬面板（`country: "SIM"`）主題「雙北國道逐車模擬」／群組「國道逐車」；不在 GATED_LAYERS，與交通可及性同為人人可見。

## 硬依賴欄位（改一定爆）

- `meta.json`：`dayStartUnix`、`winStart`／`winEnd`、時段長度、part 清單 — 時間對齊與分段載入
- `trips.bin`：on／off／first／last（u16）、vt、spd、flags（u8）— 車種篩選、上下交流道說明框
- 時段檔：`seg_id`、`kf_base`／`kf_off`、`ev_base`／`ev_off`、`kf_node`、`kf_time`、`ev_time`、`ev_lane` — 合併靠 kf_base／ev_base 去重，邊界至少保留 2 個 keyframe

## 上游改動 → 下游要跟改的觸發點

| 上游改動 | 下游動作 |
|---|---|
| 換日期或時段 | 重跑 build 腳本＋verify，發新版本；CHANGELOG 與圖例文字的日期要改 |
| 車種代碼（vt）增減 | `freewayTdcsSimTypes.ts` 的 FREEWAY_TDCS_VT_* 與圖例 |
| 二進位欄位或型別改變 | `freewayTdcsSimModel.ts` 解碼、verify 腳本 |
| 換道規則或 keyframe 密度改變 | 時段檔大小會變，build 腳本會自動挑 ≤2 MB 的時段長度，確認仍是 300 秒或更新文件 |

## layer-onboarding 驗收（2026-11-04）

| 項目 | 結果 |
|---|---|
| manifest entry＋layerParamsSpec | ✅ `freewayTdcsSim`；`layerConsistency` 測試通過 |
| 透明度 | ✅ `freewayTdcsSimOpacity`（預設 0.9），custom layer 以 `getOpacity` 讀 |
| 圖例 | ✅ `legend: "freewayTdcsSim"`（車速／車種色階，載入狀態文字） |
| popup | ✅ `popup: "freewayTdcsSim"`（點車看上下交流道、跟隨） |
| select | ✅ 顏色模式 select＋車種 multiSelect |
| Loading UI | ✅ 共用檔與時段檔都經 `withLoading` |
| 動態圖層時間訂閱 | ✅ 走 timeStore.subscribe／render 內 getTime，`currentTime` 不進 deps |
| 資料來源總覽 | ✅ pulse_only＋derivedFromDatasets，顯示 TDCS M06A 出處與推算說明 |
| 上游登記 | ✅ owner 測試 `PULSE_OWNER_TESTS=1`（analytics origin/master 3d0f0e31）：pulse_only 衍生解析通過；唯一失敗是既有 10 筆「主題.id」寫法的舊斷鏈（poi.public_life_osm 等），與本層無關 |

## 已知不對稱

- 上游 data-registry 用 `transportation.freeway_tdcs_sim`，Pulse 與 pulse-data 用 `freeway_tdcs_sim`。
- 模擬只涵蓋一天兩小時；全站時間軸在這段以外時，圖層不畫車。
