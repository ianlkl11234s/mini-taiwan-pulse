> 2026-09-08 後續：使用者授權僅本人帳號遠端私人研究。新存取架構與驗收狀態見 [private-access](./private-access.md)；下方本地整合紀錄保留為歷史證據。

# 珊瑚礁歷史分布：本地前端交接

2026-09-08：本地圖層整合與 browser 驗收完成；**僅個人非商業研究，未部署、未公開散布**。

上游契約：[coral-reef-layers](../../../../taipei-gis-analytics/docs/handoff/coral-reef-layers.md)，[data catalog](../../../../taipei-gis-analytics/docs/data-catalog/marine/coral_reef_distribution.md)。本輪不修改上游資料或 QA；未接 NODASS 134，未建立 migration／collector／動態 pipeline，初次本地驗收階段未 commit／push／merge；使用者確認後另授權程式碼 commit 與 PR，仍不 merge／部署。

## 本地使用

在本 repo 執行 `npm run dev -- --host 127.0.0.1 --port 3724`，開啟 [本地站](http://127.0.0.1:3724/)。桌面：世界 World → 世界 → 環境 →「珊瑚礁歷史分布（本地研究）」；手機：底部圖層面板 → 世界 → 世界 → 環境。預設關閉，透明度 0.55，單色 fill＋outline，圖例可展開，點擊原始 polygon 開啟 popup。

PMTiles 仍在 analytics 的 `data/processed/marine/coral_reef_distribution/`，由 Vite `apply: serve` middleware 讀取固定檔案，以 `/__local-research/coral_reef_distribution_global.pmtiles` 提供 loopback-only GET／HEAD／Range。未複製至 `public/`，沒有 GeoJSON frontend fallback、CDN URL 或 deploy asset 清單。production 的 catalog、hook 與 URL layer 狀態排除本層。需要上述兄弟 repo 與原檔才能本地重跑。

## 資料契約

UNEP-WCMC／WorldFish Centre／WRI／TNC 暖水珊瑚礁歷史基線，v4.1，2021 年 3 月發布；實際分發為 UNEP-WCMC 官方下載，NODASS 34 為目錄。授權為 UNEP-WCMC General Data License (excluding WDPA)，沒有再散布權。不是現況健康、活珊瑚覆蓋率或白化。

- source ID `coral-reef-distribution`；source-layer `coral_reef_distribution`；z0–12；z12 以上 overzoom，沒有自創 geometry。
- 全球來源 17,504 features，42 invalid 修復後有效，0 reject／null geometry／empty geometry；925 points scope excluded。
- 臺灣 GeoJSON 是研究窗口選取的 508 原始 Polygon 部件／20 source features，非行政海域界；本輪只使用全球 PMTiles。
- MVT 缺属性當 null，popup 顯示「未提供」，不補零或空字串。`source_year` 全 null；2021 是發布年，不是觀測年。
- `area_km2` 是全球整筆來源 feature 的 EPSG:6933 面積，非臺灣選取部件面積，不加總。極小正值保留科學記號，不捨入成零。
- popup 保留全部 19 欄：feature_id、reef_name、source_dataset、source_version、source_year、origin_org、distribution_org、license、area_km2、geometry_status、built_at、source_metadata_id、source_loc_def、source_start_date、source_end_date、source_date_type、source_data_type、source_verification、source_layer_name。來源幾何定義常駐，詳細來源可展開。
- 低 zoom 量化／簡化有可見性損失；空白或來源缺 coverage 不等於沒有珊瑚。金門／太平島視窗相交不代表行政或主權範圍；馬祖是本版 coverage 缺口。

## 已核對產物

| 檔案 | bytes | SHA-256 |
|---|---:|---|
| coral_reef_distribution_global.pmtiles | 133400197 | b6b0dba6ee6923add86d86312f81131d2b25fd6cb566732f84375ab301467ea3 |
| coral_reef_distribution_taiwan.geojson | 1489893 | 05c5a2af2c1c26d14251cbdc14cb2d6e8a5de7f208974a5a4b2bb41764367afa |
| qa_summary.json | 291590 | c5bc1f08f618dfb84cc957dc191245806e0a362aa14457873447907678a3e943 |

三者與上游 handoff 完全一致，整合結束再算仍一致。

## 實作與驗收

manifest／params spec 派生既有目錄與控制項；獨立 `useCoralReefDistributionLayer` + Layer Host 沿用 mapbox-pmtiles source 註冊機制。共用 overlayManager 是 eager source 與 hide-only，不符合本輪 off 清理和失敗語意，因此沒有將本層加入 OVERLAY_REGISTRY，也沒有重構其他 overlay。

hook 登記 source-scoped loading，成功結束 loading；error／30 秒逾時顯示錯誤且隱藏部分圖形；關閉時清 timer、listener、layer、source；底圖 style.load 可重新掛載，map 已銷毀時 cleanup 安全退出。詳細結果：[browser 驗收](./browser-acceptance.md)。

既有 dirty 變更保留；共用檔只加入 coral 接線。Golden fixture 相對本輪開始只有 keyCount +1、coral params、coral click entry；沒有重寫既有 overlay 行為。

## PR delivery

使用者確認本地成果後授權提交。程式碼獨立移植至最新 origin/master（db7dc1c8），保留新 master 的其他功能；PR 僅包含 coral 相關程式、測試與文字交接文件。原始 PMTiles／GeoJSON、本地 browser JSON／截圖／logs 均不進 commit。原工作區未切換分支或清除 dirty 內容。

獨立 PR checkout 驗證：`npx tsc -b` 通過；`npm test` 154 files passed、1321 passed／3 skipped；`git diff --check` 通過。此數字是新 master 上的測試，原本地 browser 證據仍以 browser-acceptance.md 為準。
