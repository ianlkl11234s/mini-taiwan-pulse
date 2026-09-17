# Allen Coral Atlas 本地 browser 驗收

日期：2026-09-15。工具：Codex CUA in-app Chromium。真人透過既有 Google OAuth 登入本人帳號；未注入或偽造 auth。前端 `http://127.0.0.1:3735`，Allen sidecar `127.0.0.1:8796`。geometry 讀上游既有檔。

## 已觀察證據

- 台灣墾丁：center 120.745,21.94 z12.5；1440×900 桌面。All Off 後只開 Allen。
- 預設 Coral/Algae 畫出沿岸珊瑚／藻類；台灣 region filter、opacity、三種主題控制可見。
- 真人 popup：`aca-benthic-983d4e9e53a3527d359c7c3b`，Coral/Algae，taiwan，`taiwan_main_penghu_green_orchid`，來源完整要素面積 0.08 km²，source year/version 均「未提供」，geometry role `benthic_habitat_class`，5m。
- 完整棲地 view 顯示多色分類；圖例已修正為隨 view 變動（1／6／10 類）。
- 地形 view：真實要素 `aca-geomorphic-30ff8d139024275858262fc5`，Sheltered Reef Slope，taiwan，來源完整要素面積 0.211 km²，geometry role `reef_geomorphic_zone`。
- 在台灣窗口切換沖繩 region filter，台灣圖形與旧 popup 清除。切換 view／region 不保留上一個分類的選取內容。
- 每個 popup 均顯示來源、取得日非觀測日、Coral/Algae 合併分類與金門／馬祖缺圖不代表無珊瑚的警語。
- 本人真實 Range 已觀察 benthic、geomorphic 206；已核對 Content-Range 與 request Range、資產大小一致。證據摘要將記錄於此。

## 地理與尺寸驗收

| 窗口 | 相機 | 實際檢查 |
|---|---|---|
| 台灣墾丁 | 120.745,21.94 z12.5 | 三種 view、台灣／沖繩 filter 差異、benthic／geomorphic popup，1440×900 |
| 沖繩本島 | 127.82,26.46 z10.5 | Coral/Algae、沖繩 filter、`okinawa_main_kume_kerama` popup，1440×900 |
| 宮古 | 125.25,24.78 z11 | Coral/Algae、完整棲地、地形、opacity 0.65→0.60、popup，1440×900 與 390×844 |
| 八重山 | 124.12,24.36 z11 | 石垣／竹富附近 Coral/Algae、`yaeyama_yonaguni` popup，390×844 |

更多真實 popup：

- 沖繩：`aca-benthic-6babbe4fa2fc06f79b2185fa`，Coral/Algae，0.158 km²。
- 宮古：`aca-benthic-070c76b6fbf7ee39da896e50`，Coral/Algae，0.215 km²。
- 宮古手機地形：`aca-geomorphic-d8249f3d7e6991b6716cae18`，Terrestrial Reef Flat，0.357 km²。
- 八重山手機：`aca-benthic-c812ea462e8ffc135179f4aa`，Coral/Algae，0.142 km²。

手機底部圖層面板可搜尋 Allen、展開詳情、切換主題／地區；圖例隨主題改變。收起圖層面板後，popup 全文、來源限制及關閉按鈕可見。這是手機尺寸瀏覽器，非實體手機效能／觸控驗收。

## 資料權限證據

- 130 次真人授權 Range 回 206，Content-Range 對 request 與資產總 bytes 的不符數為 0。兩個產品都實際取用，詳 `range-runtime-evidence.json`。
- 真人點擊登出：2026-09-15T13:25:19.773Z `POST /api/private-research/allen-coral-atlas/revoke` 回 200。之後 UI 顯示 Google 登入、Allen 鎖定；實際圖形、Allen attribution、legend 與 popup 消失。
- 登出後經本地 Vite proxy 對兩份資產各作無 Authorization 的 GET／HEAD、`Range: bytes=0-127`：4/4 回 401、無 Content-Range、`private, no-store`，見 `anonymous-range-evidence.json`。
- 非本人 403、拒絕 body、當前 token、持久撤銷後 session replay、來源檔替換後仍供已驗證快照，均有自動測試；**沒有真實非本人登入及已登出 bearer 的真人重放證據**。
- Browser 工具直接導向私人 API 被 client 阻擋，因此不將這個導頁嘗試當成 HTTP 401 證據；401 證據來自上述實際 proxy HTTP 請求。
- 額外匿名路徑 HEAD：`/__local-research/allen_coral_atlas_benthic.pmtiles` 回404；公開檔名與 `@fs` 嘗試僅回 Vite HTML fallback，未回 PMTiles content type，見 `no-public-route-evidence.json`。
- `public/`、`dist/` 無 Allen／UNEP 私人 archive；Allen 不在 deploy asset 清單、不使用公開 CDN，URL layer 與私有 params 排除有測試。

## 測試與修正

- 最終 Vitest：160 files passed；1,360 passed、3 skipped。`evidence/vitest-final.log`。
- TypeScript：`npx tsc -b` 在接線後通過；最後 browser 修正以本地同版 `./node_modules/.bin/tsc -b` 再確認通過（npx wrapper 一度停滯）。
- Browser 修正聚焦：4 files／26 tests passed；`evidence/focused-browser-fixes.log`。
- 私人服務：Node test 17/17 passed，包含 exact allowlist、owner auth、Range、persistent revoke 與 snapshot immutability。
- Vite build 通過，僅既有 chunk size 警告；`evidence/build.log`。build 不等於部署。
- 初輪全套 5 failures 為 Allen golden snapshot／動態 layer scanner 未更新，已修正並重跑全套通過。
- 初次 sidecar .env 載入錯誤造成 503，修為 `.env` 後 `.env.local`。初次沖繩載入逾時已實際確認 fail-closed UI，之後改已驗 SHA 的 immutable memory snapshot（兩檔合計約147 MB、auth不快取），並採30秒無進展逾時；沖繩重驗成功。
- 視覺發現並修正：圖例只列當前 view；切換主題／地區清除舊 popup。

## 限制

- 未提供非本人真實測試帳號；伺服器測試可驗證403分支，但不能替代真人非本人 browser 登入。
- 圖片已透過 CUA 在本對話檢視；未將私人圖形上傳公開服務。
- 本地驗收後使用者已授權 commit；沒有部署、公開上傳或 push。

## 既有 UNEP 圖層補驗

- 本地 Vite 的 legacy coral proxy 因 8789 sidecar 未啟動而回 500，入口權限檢查因此鎖定。已補啟動既有 owner-only 服務，重新載入目前頁面後解鎖。
- 本人帳號實際啟用「珊瑚礁歷史分布（私人研究）」後，台灣、澎湖及琉球周邊紅色珊瑚範圍顯示，loading 消失、UNEP attribution 存在。
- 服務恢復後匿名 access probe 實測 401，回應 private, no-store；使用者確認目前正常。
