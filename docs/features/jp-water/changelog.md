# Changelog — 日本水資源

## 2026-09-19 — owner-only private Range transport

- 八個全國 PMTiles 圖層改走同域 owner-authenticated Range API；不再用 DEV localhost 或完整檔案 fetch。
- 新增兩個固定私人物件 allowlist、SHA/bytes 驗證、Supabase 固定 owner 驗證、session revoke、8 MiB Range 上限與 `private, no-store`。
- 八層加入 `GATED_LAYERS`，排除 URL share/embed/snapshot/replay；401/403/logout 會移除 source/layer/selection。
- 保留既有四個公開層與外部 GSI 洪水背景。私有傳輸不等於來源授權結論；發布證據另行驗收。
- 建立獨立私人 bucket，啟用四項 Public Access Block、BucketOwnerEnforced、AES256 與 versioning；兩份 immutable object 完整 readback SHA/bytes 通過，未簽署 URL 均回傳 403。
- 本機真實 owner 瀏覽器驗收全國上／下水道渲染、分類圖例、名稱 popup 與 logout 即時撤權；production 驗收仍須在部署後另做。

## 2026-09-19 — supply / sewer facility categories

- 重建本機 `water.pmtiles`，上水道 P21 點依日文設施名稱保守分類；9,976 點中 9,432 點命中規則、544 點明示保留未分類。
- 下水道 P22 依來源子型分成 3,539 泵場與 2,185 處理場；legend 與 popup 顯示分類、分類依據、事業／系統及設施名稱。
- 本機瀏覽器點選驗收「北ポンプ場」（P21 名稱推定）、「池添ポンプ場」（P22a）、「峡東浄化センター」（P22b）；console warning/error 為 0。
- 當時八個全國 PMTiles 圖層仍為 LOCAL_ONLY；production catalog 與 host 都會 fail closed。此狀態已由上方 2026-09-19 owner-only 私有 Range transport 取代；兩份混合 PMTiles 仍未加入 public/CDN。

## 2026-09-18 — national LOCAL_ONLY frontend wiring

- 依上游 `1e90db6c` 接入八個全國 PMTiles source-layer 與可選GSI洪水背景；保留既有四層與原湖泊 GeoJSON。
- 本機 only：未把受限資產加入 public/CDN，也沒有 commit、push、merge 或部署。
- 加入 Range 206／127-byte preflight；可讀時核對 `Content-Range` total，再以完整 bytes／SHA-256 驗證檔案，並加入可見錯誤與重試、來源年／歷史／覆蓋／MAFF定位提示及官方洪水圖例。
- 本地瀏覽器驗收八個向量層同時顯示、水壩／農業池 popup、洪水 raster／官方圖例及 390×844 響應式界面；非 production 或實體裝置證據。

## 2026-09-18 — contract-only

- 建立既有 layer key 的 geometry/provenance 契約與 fail-closed release loader。
- 未 upload、deploy、publish 或聲稱 production ready。

## 2026-09-18 — popup copy

依使用者要求，移除四層共用資訊卡的「資料處理」欄位與加工說明文字。
