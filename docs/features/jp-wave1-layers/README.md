# 日本第一波圖層（jp-wave1-layers）

> **狀態**：本機完成（2026-10-25，分支 `feat/jp-wave1-layers`，未 push、未開 PR）；正式站驗收與 S3 上傳待發版。

## 一句話說明

日本分頁新增 3 個靜態 PMTiles 點位圖層：避難場所（199,346）、役所與公民館（79,532）、公車站（278,515）；預設 off。

## 圖層與 runtime 路徑

| layer key | 位置 | PMTiles | 供應 | 型別／色票 SSOT |
|---|---|---|---|---|
| `jpEvacuationSites`（避難場所） | 民防避難 › 點位 | `public/world/jp_evacuation_sites.pmtiles`，67MB，z5–14，z10 起全保留 | **S3 deploy-assets/world/**（gitignore） | `src/data/jpEvacuationSiteTypes.ts` |
| `jpPublicOffices`（役所與公民館） | 基礎建設 › 公共設施 | `public/world/jp_public_offices.pmtiles`，46MB，z5–14 全保留 | **S3 deploy-assets/world/**（gitignore） | `src/data/jpPublicOfficeTypes.ts` |
| `jpBusStops`（公車站） | 交通 › 點位 | `public/world/jp_bus_stops.pmtiles`，20MB，z5–13，z12 起全保留，z14+ overzoom | git-track | `src/data/jpBusStopTypes.ts` |

- hook：`src/hooks/useJp{EvacuationSites,PublicOffices,BusStops}Layer.ts`；host：`src/layers/hosts/japanHosts.tsx`；popup：`japanPanels.tsx`；圖例：`legend/civicServiceLegends.tsx`
- 密集點（R5）：三層都 >10k 點，出點前畫熱區（避難場所、公車站 z12 起出點，役所 z10 起）；透明度預設依點數（0.6／0.75／0.6）
- 日本分頁新增「民防避難」「基礎建設」兩個主題（`JAPAN_TAB_THEME_TITLES` 由 15 增為 17）；公車站放進既有「交通 › 點位」

## 控制項

- 避難場所「災害種別」select：全部／洪水／崖崩れ等／高潮／地震／津波／大規模な火事／内水氾濫／火山現象／只看指定福祉避難所。災害種別只有指定緊急避難場所有值、福祉避難所只有指定避難所有值，兩者互斥，所以合成單一 select（避免選出空集合）
- 役所與公民館「設施分類」select：預設（不含集會施設）／全部／5 類各一；熱區與點共用同一篩選
- 公車站：只有熱區色、透明度、點大小

## 資料語意（必保留）

- 避難場所：兩種場所法定意義不同，不可相加；市町村自願登錄，可能非最新或未登載，請向市町村確認（GSI 警語）；檔案時點 2026-10-19
- 役所與公民館：2022-04 基準，之後的合併、閉館未反映；不能當現況營運名冊
- 公車站：2022 年度版，不含デマンドバス與高速バス；PMTiles 只帶 route_count，不含系統名；低 zoom 為抽稀概覽，不可數筆數

## 資料夾內文件

- [handoff.md](./handoff.md)：上游契約、SHA-256、接線與驗收紀錄
- `screenshots/`：本機瀏覽器驗收截圖
