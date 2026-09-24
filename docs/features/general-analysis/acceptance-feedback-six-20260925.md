# 新對話回饋：六片修正與驗收（2026-09-25）

本次為 2026-09-24 六片之後的新回饋修正，不覆寫舊驗收。只在 `research-streamline/{mini,mcp,gateway}` 開發；原 checkout 僅同步使用者要求的 skill，之前內容備份於相鄰 runtime。未 push、PR、merge 或部署。

## 六片狀態

| 分片 | 本次修改 | 證據與剩餘關卡 |
|---|---|---|
| 1 啟動／skill 一致 | 專用 3734→8794 啟動預檢、可追蹤 Vite template、固定 analytics root 與三個 preview flags；實際 skill 入口同步 | status 實測兩 port in_use、boundary/config/key 存在；未停止既有服務。start 流程未實啟，TCP 監聽不等於 browser/full-chain |
| 2 全台統計呈現 | compare_regions 從 8 擴至 22，MCP 與 Gateway 同步；用數值比較保留行政區 geometry，避免 generic key_join 再 metric 失去地圖資格 | 同期、單位、分母、missing/suppressed gate 保留；全台真邊界 22 features／332,091 vertices／14,719,725 bytes，已調整 scene 共用預算為40萬頂點／24MiB，並移除巨大陣列spread造成的RangeError；真資產本地present/bounds通過。新全鏈尚待配對與新版MCP |
| 3 多物件／嘉義 | store 128 entries、96MiB serialized JSON、24MiB per-entry；先規劃淘汰再 mutation，active scene 仍限 8 層；修 Turf 微 connector 的拓樸誤拒 | 真 31 route-direction records、125.5m 環域：修前27成功4失敗、修後31成功；不是31條獨立實體路線。未以此宣稱所有半徑／全域拓樸保證 |
| 4 對話／定位 | 新 conversation reference：從可用資料生成首次探索方向、追問重用結果、append vs replace、一次 framing/readback；明確 Google provider 跳過本地離線查詢；地圖 flyTo 1.1s、reduced-motion 0s、可取消 | Google API 實測3筆公開地址；未接到 Mapbox 顯示。自然語句泛化、追問飛行仍待正常配對新對話驗收 |
| 5 共用面板／搜尋 | Layers、Locations、Agent 共用 PanelHeader，移除協作面板外框；每個 resultId 獨立 opacity；Locations 與 layer search 臺/台正規化、多詞 preset 查詢 | browser 深／淺色空面板目視、Locations「臺東」命中台東、「臺 南」命中台南通過。每層 opacity/reorder/style 由程式測試驗證，真多層互動待配對。Locations 仍是預設鏡位搜尋，不是任意地址搜尋 |
| 6 資料擴充 | 三個經固定 SHA/count 驗證的 Point reader：堰塞湖32、山區通訊點1416、山徑路標3407 | 見 qualification-forestry-20260925.md；不是即時災害、訊號或步道開放資料。45份已發布 social statistics 原已全接；24份農業 local-only、188份 comparison 缺契約仍不升格 |

## 為何之前的測試失敗

- 被審閱對話：`配對 Pulse 並探索地圖圖層`，task `01a0d3fb-5454-70e0-9d38-13095d61462d`。實際全台失敗題是女性人口占比，不是已驗證人口密度題。
- 頭城追問只有文字、未呼叫地圖工具；屬對話決策缺口，不是 renderer 不支援七筆紀錄。
- 全台 generic join 將 geometry 變成 left/right 欄位且結果標為 none，超過 transport 時也無法當區域比較圖呈現。正確的 compare_regions 保留 geometry；禁止靠增加傳輸頁面假裝解決。
- 嘉義單次已成功顯示路線＋環域＋圖書館三層；批次中間結果超過原16筆 store容量會淘汰早期結果。因此不是完全不支援多圖層，也不能把所有 result missing 都說成 TTL。
- 4個環域失敗來自約2e-13–8e-13度 connector 與既有1e-12拓樸容差不一致。修補只影響拓樸判斷，保留輸出座標；新形成鄰接仍驗證，不跳過 spike/overlap。真來源、合法微 connector、自交與反向重疊皆有檢查。
- boundary missing 的直接原因是隔離 Vite 缺 analytics root；目前本地 county asset 可讀，但 HTTP可讀與正常地圖上圖仍分開。

## 定位測試與限制

使用者授權 Google API 測試，總計3筆送達的公開地址查詢，無循環、排程或新 provider訂閱；另2筆 sandbox 網路拒絕未取得 provider response，重跑僅為已識別網路限制。

| 路徑 | 輸入 | 結果 | 時間 |
|---|---|---|---|
| 現有 native MCP（舊 process） | 新竹中華路二段445號 | local unavailable、Google matched／GEOMETRIC_CENTER | total 20,365ms |
| 新版 Google adapter 直接測試 | 羅東公正路2號 | matched／GEOMETRIC_CENTER | 1,344ms |
| 新版 Google adapter 直接測試 | 屏東公勇路62號 | matched／ROOFTOP | 321ms |

不同地址與測試路徑，不是嚴格同題A/B，也不是完整對話時間。MCP wire regression驗證指定Google不呼叫offline adapter；現有native process仍需載入新build才可驗證同一路徑時間。不保存provider原始回覆、經緯度或place cache到資料庫。

[Google Geocoding顯示政策](https://developers.google.com/maps/documentation/geocoding/policies)與[Places政策](https://developers.google.com/maps/documentation/places/web-service/policies)要求地圖中的結果使用Google地圖。目前Mapbox介面不直接使用這些結果；新地址泛化方向已納入，但可上圖provider方案尚未完成。未聲稱已接Places Text Search。

## 驗收層級

- Mini：15個相關測試檔131 passed，包含 RUN_RAW_BOUNDARY_INTEGRATION=1 真22縣市資產測試；tsc -b通過。
- MCP：geocoder/server相關22 passed；schema擴至22後server13 passed、build通過。
- Gateway：relay-service23 passed（含22成功、23拒絕）。
- browser：深／淺色無外框協作面板與臺東鏡位搜尋已目視；未把單元測試算成browser多層驗收。
- 正常 Codex→MCP→Gateway→browser：本次未完成。native session原為unpaired；建立測試pair後停在waiting_confirmation，未代按網站確認，後續PAIRING_REJECTED／網站到期。沒有繞過確認或重用其他task憑證。
- 資料、source health、production、公開發布為不同關卡；本次沒有發布證據。

## 下一個驗收點

1. Gateway已核對PID及launcher後由94929精確重啟為94788（tool session67484），保留原sqlite；MCP已build但目前對話仍需載入新版process。不可廣泛pkill或清除storage。
2. 使用者完成網站配對確認後，驗全22區男性占比（新變體）、嘉義兩路線＋環域＋圖書館、單層透明度與style切換、追問定位／手動中止。
3. 再以新地點與問題變體驗首次引導與定位，逐題記工具數、provider calls、source/precision、ready及resultPresentation。無配對時不宣稱完成第六片的整體驗收。
4. 第七片「agent互動感」保留討論，等待使用者素材；本次僅做真實狀態語氣與短飛行動畫，未做額外動態展示或代理思考動畫。

## 原子提交與接手

Mini：`a6708f6e` 22區核心、`0ef11c53` store預算、`5ceacd1d`面板與搜尋、`f7ae2b24`飛行與狀態、`44a76bb7`啟動預檢、`6f20c916`探索skill、`a9db05f5`三份Point、`3ba31284`topology、`a29f8864`真全台呈現、`b6d6ed21`路標未知單位。MCP：`941ccda`外部定位直達、`739ca40`22區schema。Gateway：`9a3c8a3`22區schema。全部僅本地commit。

原始county asset的完整bounds為 `[114.35928247200002,10.371347663000051,124.56115802500004,26.38527526200005]`，包含遠方離島；完整fit會很廣。未悄悄刪除離島或改來源幾何。後續若設計本島主視圖＋離島提示，必須明示取景與分析coverage不同。40萬頂點提高單scene工作量，並未減少14.7MB原始載入；generalized display sidecar仍可另做優化，不能冒充actual分析geometry。

起始配對等待過期不是授權拒絕；新一輪驗收仍需有效pair與網站本人確認。六片本地改動已提交，整體使用者驗收仍開放。
