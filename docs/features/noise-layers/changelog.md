# Changelog — 噪音／聲響六圖層

> 最新在上；release 前維持 Unreleased，不把本機實作誤寫成已 deploy。

## 2026-08-28 — Unreleased（已 local commit／未 push／未 deploy）

- 新增 `officialNoiseMonitoring`、`noiseCaptureGrid`、`noiseControlZones`、`aviationNoiseZones`、`noiseEnforcementEvents`、`soundCameraLocations` 六個獨立 layer contract。
- 發布五個新靜態副本；`noiseEnforcementEvents` 重用既有 `public/geo/pollution_penalties.pmtiles` 與 `pollution_penalties` source-layer，不複製第二份資產。
- NoiseCapture 使用單一 toggle／source 與三個互斥尺度；保留 5 格全部 provisional、ODbL/DbCL attribution 與「留白不等於安靜」聲明。
- 官方測站 period 單選預設 day，filter 同時保留 unavailable；popup/legend 保留 sample window、active-day coverage、freshness 與來源語意。
- 法定管制區、航空里別、裁處事件、聲音照相各自保留 coverage、法律語意、spatial precision 與 null fallback，不建立綜合噪音分數。
- 新增 asset／欄位／數量／PMTiles metadata／registry 契約測試；golden fixture 已 regenerate，移除六個新 key 後既有 387 keys 的三個 section 無漂移。
- 本機驗證：`npx tsc -b` pass；focused 52 tests、full 748 passed／1 skipped；五個新資產 count／SHA 與三個 PMTiles verify／localhost readback pass。
- localhost browser：由 All Off 實際切換六層，覆蓋 official fresh／historical／unavailable、NoiseCapture 三尺度交棒、管制區、航空里別、camera precision filter 與裁處事件；legend／popup 語意符合契約，console 無 error／warn。
- Release truth：local commit 已建立；push、deploy、production HTTP/browser 仍未執行，須等待 owner 授權。
- Breaking：無 Supabase migration、無 collector、無既有 API contract 變更。
