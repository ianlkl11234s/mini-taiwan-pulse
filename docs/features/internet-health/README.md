# 臺灣網路健康（RIPE NCC 網路觀察）

> **Slug**：`internet-health`
> **狀態**：shipped（2026-08-31～09-01 隨 v1.17.0 上線；Monitor 卡片，無地圖圖層）
> **相關 PR**：#184、#192、#195、#197、#200（CHANGELOG.md：監看模式臺灣網路健康、RIPE 量測值與觀測時間軸）

## 一句話說明

在 Monitor 顯示臺灣的 RIPE Atlas／RIPE RIS Live 網路量測與歷史趨勢，僅呈現觀測值、freshness、coverage，不單憑 RIPE 判定「正常／斷網」（`OBSERVATION ONLY`）。

## Runtime 路徑

- RPC：`public.get_internet_health_status`（entity `country`／`TW`）
- `src/data/internetHealthLoader.ts`：RPC、parser、彙整規則
- `src/components/intel/monitor/TelecomStatusCard.tsx`：狀態卡與 5 分鐘輪詢；接線於 `MonitorPanel.tsx`、`monitorLayout.ts`、`monitorSplitLayout.ts`
- 不新增 layer key／Mapbox source／popup；既有 `ripeAtlasProbes`（全球探針概覽）與 `internetExchangePoints` 為獨立圖層，本卡不替它們染色。

## 資料來源

RIPE Atlas、RIPE RIS Live，經 platform public RPC 的 allowlist 訊號；上游契約與 detector 欄位見 [handoff.md](./handoff.md)。

## 驗收方式

[handoff.md](./handoff.md) 的「驗收邊界」與「Browser live gate」：migration、collector、RPC anonymous grant、browser QA 與 deploy 需分別確認；單元測試在 `src/data/__tests__/internetHealthLoader.test.ts` 與 `src/components/intel/monitor/__tests__/TelecomStatusCard.test.ts`。

## 文件索引

| 文件 | 用途 |
|---|---|
| [handoff.md](./handoff.md) | 產品目的、RPC 契約、前端彙整規則、RIPE 擴充契約、驗收 |
