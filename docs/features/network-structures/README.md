# 路網結構（network-structures）

> **狀態**：shipped（四層 OSM／官方橋梁：Analytics PR #79、前端 [PR #222](https://github.com/ianlkl11234s/mini-taiwan-pulse/pull/222) 已合併，正式站 Range 206 與顯示驗收通過）；2026-09-24 擴充五層與全臺橋梁研究圖層的正式站狀態以 handoff 為準（部分為站主限定／未驗收）

## 一句話說明

交通 Move →「路網結構」下的橋梁等基礎設施靜態圖層：OSM 橋梁承載線與輪廓、新北市官方橋梁、OSM × 官方候選比對，並擴充臺南／新竹橋梁、臺北／臺南隧道、彰化號誌。

## 圖層（layer key，見 `src/data/layerManifest.ts`）

- 已發布四層：`osmBridgeCarriers`、`osmBridgeFootprints`、`officialBridgesNewTaipei`、`bridgeComparisonNewTaipei`
- 本地擴充：`tainanBridgeInspections`、`officialBridgesHsinchu`、`taipeiRoadTunnels`、`tainanRoadTunnels`、`changhuaTrafficSignals`、`bridgeRainThresholds`

## 主要檔案

- 型別：`src/data/networkStructuresTypes.ts`
- 發布腳本：`scripts/deploy/publish-network-structures.py`（預設只列計畫，`--apply` 才寫入）
- 資料：靜態 PMTiles（`deploy-assets/network_structures/`），無 DB migration／RPC／collector
- 上游 SSOT：`taipei-gis-analytics/docs/handoff/network-structures.md`

## 驗收

13 份 storage 物件 SHA-256 讀回、正式站 HTTP Range 206 與 browser 驗收（證據：`../../archive/2026-10-16/audit/network-structures-release-20260906/README.md`）。

## 資料夾內文件

- [handoff.md](./handoff.md)：上游版本、四層契約、部署保全、2026-09-24 擴充與全臺橋梁研究圖層
- [changelog.md](./changelog.md)：2026-09-06 發布、2026-09-25 擴充待發布
- [backlog.md](./backlog.md)：已完成清單與後續增量

相關：橋梁韌性專題為另一組圖層（`bridgeResilienceTwinCity` 等），不在本資料夾。
