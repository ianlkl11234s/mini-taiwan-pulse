# Earthquake Replay（地震回放）

> **Slug**：`earthquakeReplay`
> **狀態**：done（agent-browser 端到端驗收通過，2026-07-31 PR merge）
> **Owner**：migu
> **上線時分支**：`feat/earthquake-replay`
> **memory 時點**：2026-07-31

## 一句話說明

選一起地震重播它的擴散過程：震央爆開 → 測站依 S 波抵達順序（`epicenter_distance_km / 3.5`）逐顆亮起 → 等震度網格由震央向外展開 → 鄉鎮面量圖定格 → 沙灘球收尾。依素材完整度分兩級：**Tier A**（有 town+grid，完整五步）／**Tier B**（僅測站，簡化三步：震央→測站→沙灘球）。

## 圖層清單（1 個 key、5 個視覺元件）

| Layer key | 視覺元件 | 資料源 |
|---|---|---|
| `earthquakeReplay` | 震央 burst / S 波前圈 / 測站 circle / 網格 fill / 鄉鎮 choropleth / 沙灘球 Marker | Supabase 清單 RPC + 四張明細表（見資料契約） |

## 關鍵檔案

- 清單+明細 loader：`src/data/earthquakeReplayLoader.ts`（RPC cachedOnce 15min + per-event keyedThunkCache 30min，全包 withLoading）
- 色階/型別 SSOT：`src/data/earthquakeReplayTypes.ts`（CWA 震度 0-7 含 5弱/5強/6弱/6強 + `townCodeToPmtilesCode` + haversine + `eventTier`）
- Layer factory：`src/map/earthquakeReplayLayerFactory.ts`（5 元件 source/layer + 沙灘球 Marker）
- Hook / 回放引擎：`src/hooks/useEarthquakeReplayLayer.ts`
- 回放時鐘：`src/state/earthquakeReplayClock.ts`（external store，比照 timeStore 慣例；通知節流 10Hz）
- UI：`src/components/EarthquakeReplayPanel.tsx`（左側浮動面板，比照 PropertyValuePanel；事件清單 + Tier badge + play/pause/scrub/重播）
- 沙灘球 SVG：`src/lib/beachball.ts`（strike/dip/rake → 下半球等面積投影自繪；對 tecdc 官方圖 4/4 方位驗證；aux plane 公式對真實資料誤差 <0.01°）

## 資料契約摘要

- 事件清單：`supabase.rpc("earthquake_replay_events")`（gis-platform mig 324）。**resolved key 契約**：`has_x = true ⟺ x_key 非 NULL ⟺ 用該 key 等值查明細一定撈得到列`。±90s（grid）/±5s（town）時間窗配對全在 DB 端，**前端禁止自己做時間窗**。
- 明細（全等值查詢）：測站 `eq(event_id)`；鄉鎮 `eq(origin_time, town_origin_time)`；網格 `eq(event_time, grid_event_time).gt(intensity, 0)`（~3,300 列，partial index）；機制解 `eq(origin_time_utc, tensor_origin_utc)`，**A 解優先 fallback R**（庫內目前全 R 是常態）。
- 鄉鎮 choropleth：自建 source `eq-replay-township`（`township_boundary.pmtiles` + `promoteId: {township_boundary: "TOWNCODE"}`），**不走 overlayManager**（比照 useRoadCongestionLayer）。CWA 7 碼 → PMTiles 8 碼轉換規則見 `earthquakeReplayTypes.ts`（368/368 逐筆驗證）。

## 回放引擎

時鐘單位=「震後真實秒數」，RAF 以 `dt × rate` 推進（rate = duration ÷ 26s 牆鐘目標，clamp 0.4–4），存 external store 不進 React deps → 回放期間 App 零 re-render。所有視覺都是當前時鐘的**純函數**（feature-state 每幀重算、量化去抖），所以 scrub = set 時鐘即可。播畢 clamp + 回呼關 playing。獨立 scoped 播放器，**不掛全域 timeStore**（時間尺度不同：秒級 vs 日級）。
