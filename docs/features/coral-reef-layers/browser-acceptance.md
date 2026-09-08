# 本地 browser 驗收 — 2026-09-08

本地 Vite `127.0.0.1:3724`、Chromium headless，桌面 1440×960／手機 viewport 390×844。使用實際主站、原始 PMTiles、DOM 開關與點擊；相機使用既有 `window.__map` debug handle。沒有使用 mock geometry。3721 屬另一工作區，未改動。

以下 browser 證據來自使用者確認的原始本地工作區（3724），不是移植至新 master 後的 browser 重測；PR checkout 另跑 TypeScript 與完整測試。圖片／JSON／logs 僅存原工作區，GitHub 上的本地 evidence 連結不會帶入檔案。

完整數字：[browser.json](./evidence/browser.json)；[產物 hashes](./evidence/artifact-hashes.json)。evidence 目錄為本地研究資料，已 gitignore，不能公開發布。

## 九個視角

數字為**整個 browser viewport**的 rendered tile fragments／去重來源 feature ID，包含 tile-buffer／跨瓦片重複，並非礁體數量或行政統計。總覽包含鄰近國家，不能與上游固定 bbox 的交集數直接比較。

| 視角 | zoom | fragments | source IDs | 截圖 |
|---|---:|---:|---:|---|
| 臺灣總覽 | 6.6 | 71 | 51 | [Taiwan](./evidence/Taiwan.png) |
| 澎湖 | 10 | 16 | 6 | [Penghu](./evidence/Penghu.png) |
| 綠島 | 12 | 6 | 2 | [Green Island](./evidence/Green-Island.png) |
| 蘭嶼 | 11.5 | 8 | 2 | [Orchid Island](./evidence/Orchid-Island.png) |
| 恆春 | 10.5 | 14 | 4 | [Hengchun](./evidence/Hengchun.png) |
| 金門視窗 | 10 | 2 | 1 | [Kinmen](./evidence/Kinmen.png) |
| 馬祖 | 9.5 | 0 | 0 | [Matsu](./evidence/Matsu.png) |
| 東沙 | 10.5 | 8 | 2 | [Dongsha](./evidence/Dongsha.png) |
| 太平島視窗 | 10.5 | 22 | 9 | [Taiping](./evidence/Taiping.png) |

各窗 capture 當下 sourceLoaded=true、coral source errors=0。馬祖 0 僅表示本版無圖形，圖例有 coverage 提醒。

## 操作、失敗與清理

- 桌面實際開關、展開透明度與圖例：[desktop](./evidence/taiwan-desktop.png)。DOM range 改為 0.25，Mapbox fill／line opacity readback 均為 0.25。
- 點澎湖 polygon 開啟 [popup](./evidence/penghu-popup.png)：cr-v4.1-04805，礁名／觀測年「未提供」，整筆來源面積 103.442 km²；幾何定義 `coral; fringing island; shallow_reef` 保留。
- 手機 [控制項](./evidence/mobile-controls.png) 開關可移除／重建 source，opacity 改為 0.55 readback 一致；[popup](./evidence/mobile-popup.png) 可讀且保留來源與缺值語意。這是 viewport 模擬，非實體手機或觸控精度證明。
- 綠島 z13.5：source maxzoom=12、6 rendered fragments，確認 overzoom 不會因超出原始最大 zoom 全空白。
- 連續五輪 DOM 關／開：off 每次 0 coral source／0 layer，on 每次 1 source／2 layers；source data／loading／error／style.load listener 數每輪回到相同基準。loading／timer／已銷毀 map 的 cleanup 另有 focused tests。
- 本地 route 的 Range 0–126 回 `206`、`Content-Range: bytes 0-126/133400197`，header magic `PMTiles`；越界 Range=416，未知檔=404，POST=404。
- 僅攔截 coral route 注入 fetch HTTP 503，實際 Mapbox source error 觸發[明確失敗提示](./evidence/load-failure.png)；恢復 fetch、關閉再開後 sourceLoaded=true 且22 fragments。不是修改上游檔案。
- 已有圖形時移往新視角並注入 tile 503，fill／line visibility 都變 none，避免局部圖形被當完整 coverage；恢復後可重開。

## 檢查與限制

- `npx tsc -b` 通過。
- `npm test`：116 files passed；1102 passed、2 skipped。含 popup null／zero／極小面積、source lifecycle／失敗／銷毀 cleanup、production URL 排除、manifest／click／host／golden 契約。
- `git diff --check` 通過。測試 log 在 [evidence](./evidence/tests.log)。
- Review 階段本地 build 通過且 dist 無 coral artifact；最終小幅 cleanup／URL 修正以 tsc 與全套測試驗證。未部署。
- 底圖切換嘗試後讀回仍為 Mapbox Dark，未把它算作 Light 底圖／style 重建驗收通過；本輪九窗及桌面／手機均以 Dark 完成。沒有擴改既有 StyleSelector。
- 未量測長時間 heap、FPS、熱耗或實機 Safari／Android；五輪 listener／source 清理不等於全面效能保證。
- Production runtime、公開主站可見性、公開 storage／CDN 全部未驗證且未發布；本地研究不授予再散布。PMTiles／GeoJSON 未加入 public、deploy 清單或 commit。
- NODASS 134 保持來源／格式研究，不接線、不建 pipeline。
