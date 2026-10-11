# 日本氣象廳即時圖層（JMA live layers）

> **Slug**：`jma-live-layers`（上游：taipei-gis-analytics `docs/topic-research/japan_opendata/jma-collectors-plan.md`）
> **狀態**：dev（PR 待併入 develop；未部署正式站）
> **Owner**：migu
> **上線日期**：—
> **相關 PR**：見 changelog

## 一句話說明

日本 tab 新增「氣象防災」主題：AMeDAS 即時觀測、警報・注意報（市町村 choropleth）、近 7 天地震、火山噴火警戒，四層皆預設關、當下快照輪詢。

## 圖層 / 元件

| 名稱（layer key） | 類型 | 資料源 | 輪詢 | 狀態 |
|---|---|---|---|---|
| `jmaAmedas` | point（可切 氣溫／前 1 小時雨量／積雪深／風速） | `public.jma_amedas_current` | 10 分 | ✅ |
| `jmaWarnings` | polygon choropleth（既有 `jp_admin_boundaries.pmtiles`） | `public.jma_warnings_current` | 5 分 | ✅ |
| `jmaQuakes` | point（半徑＝規模、顏色＝最大震度） | `public.jma_quake_latest`（近 7 天） | 2 分 | ✅ |
| `jmaVolcanoes` | point（噴火警戒レベル） | `public.jma_volcano_current` | 10 分 | ✅ |

出典：気象庁（公共データ利用規約1.0）— 圖例、popup、source attribution 三處都有。

## 關鍵檔案

- 色票／分級 SSOT：`src/data/jmaTypes.ts`
- Loader＋狀態 store：`src/data/jmaLiveLoaders.ts`
- Hook：`src/hooks/useJmaLiveLayer.ts`（3 點層）、`src/hooks/useJmaWarningsLayer.ts`（警報 choropleth）
- Host：`src/layers/hosts/jmaHosts.tsx`
- Overlay：`src/map/overlayRegistry.ts`（jmaAmedas／jmaQuakes／jmaVolcanoes，dynamicData）
- Legend：`src/components/legend/jmaLegends.tsx`；Popup：`src/components/featureInfo/jmaPanels.tsx`
- 測試：`src/data/__tests__/jmaLive.test.ts`

## 資料契約摘要

看 [handoff.md](./handoff.md)。

## 相關 backlog / 歷次改動

[backlog.md](./backlog.md)、[changelog.md](./changelog.md)
