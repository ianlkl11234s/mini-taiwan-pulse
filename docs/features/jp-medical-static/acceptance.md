# 本地驗收

狀態：第一批本地前端驗收完成（2026-09-14）。實際 browser 與資料／HTTP／build 分別驗證；正式發布 not run。

| 證據 | 狀態 |
|---|---|
| source counts / mapped counts / excluded counts / 唯一鍵 | PASS：Navii 206,043 / 189,800 / 16,243；H17 222,615 / 222,194 / 416 非空間 + 5 重複 |
| exact allowlist SHA-256 / bytes / private denylist | PASS：778 assets 全檔；完整發布 781 項共 1,640,390,952 bytes |
| localhost JSON / PMTiles metadata / Range 206 | PASS：[http-acceptance.json](./http-acceptance.json)，五份 PMTiles 206，三類詳情樣本 bytes/SHA |
| TypeScript / tests / build | PASS：完整 suite 159 files / 1,354 passed / 3 skipped；最後修正後相關 13 tests 與 `npm run build` PASS |
| 桌機：全國、東京、地方尺度 | PASS：1440×900；全國 z4.5/4.7、東京 z8/16、札幌 z13；另於正常視窗 1280×720 驗長照篩選 |
| 手機：全國、東京、地方尺度 | PASS：390×844 browser viewport；全國 z4、東京 z13、札幌 z16、醫療圈 z8。實體手機 not run |
| 篩選、圖例、opacity、點選詳情、hours一對多 | PASS：五類開關、全關提示、透明度 0.40、35 服務選單、三層級切換；醫院 24/90 筆 hours；桌機及手機截圖 |
| 同址多服務、缺值、錯誤、歷史日期 | PASS：東京同址 2 筆；網站／時段未提供；本地失效 pointer → 錯誤 → 恢復原檔 → UI 重試恢復點位；A38 STALE |
| S3 / CDN / production / deployment | not run |

## 資料數量（來源列 / 可繪製 / 缺座標）

| Navii 類別 | 來源列 | 可繪製 | 缺座標 |
|---|---:|---:|---:|
| 醫院 | 7,715 | 7,447 | 268 |
| 診所 | 80,155 | 75,190 | 4,965 |
| 牙科 | 54,637 | 51,384 | 3,253 |
| 助產所 | 2,138 | 1,684 | 454 |
| 藥局 | 61,398 | 54,095 | 7,303 |

Navii來源快照2026-06-01；助產所來源缺德島／沖繩（36/47），不補零。H17快照2026-07-09，35類服務登記；四欄 `source_id + establishment_id + service_type + name` 在此snapshot的222,194筆可繪製資料中唯一，可去除跨tile複本，不能把同位置不同服務合併成機構。

Luna獨立確認兩份z6 aggregate 的mapped計數依類別／服務加總分別為189,800／222,194。每cell附著的source_record_count與excluded是全國參考值，不可跨cell累加。A38 2020 display簡化、parts語意保留。

版本：`d6f57fb991d7c714950fd6f334151ca9f4e6f27a887d2a0410e75b6b2223535a`。

本地HTTP驗證：`python3 scripts/preprocess/verify_jp_medical_local.py`。SHA為完整本地檔案；HTTP PMTiles讀回為127-byte header Range，不代表實際畫面證據。

## 實際 browser 驗收

使用 Codex in-app browser 操作實際 Mapbox canvas、抽屜、分類按鈕、原生 select 與 popup；未以程式注入 map 狀態代替操作。手機是響應式 viewport 驗證，不是 iOS Safari 或實體裝置證明。截圖位於 [screenshots](./screenshots/)。

| 案例 | 可觀察結果 | 截圖 |
|---|---|---|
| 全國 Navii | 聚合 count 顯示，圖例分列來源／可繪製／缺座標 | desktop-national.png、mobile-national.png |
| 助產所單選 | 2,138／1,684／454，未補德島、沖繩 | desktop-midwife-filter.png |
| 五類全關 | 未選取分類提示；不將空篩選當來源零值 | desktop-empty-filter.png |
| 東京醫院 | 宮内庁病院 ID 1311130100110，24 筆 hours，按科別一對多展開；網站未提供 | desktop-hospital-hours.png |
| 札幌醫院 | 札幌医科大学附属病院 ID 0111010000010，90 筆 hours，週末未提供明示；文字色及網址對比已修正 | mobile-hospital-detail.png |
| 城市／街區 | 東京 z13 與札幌 z13/16 由聚合切换為分類點位 | desktop-sapporo-z13.png、mobile-tokyo-z13.png、mobile-sapporo-z16.png |
| H17 共址 | [139.8314666,35.7049251]：さんいくハイツ立花、東京清風園，2 筆不同服務及 ID 保留 | desktop-care-colocated.png |
| H17 篩選 | 短期入所生活介護，z6-56-25 格網 popup 5,921；與原 aggregate 一致，不是全國總數 | desktop-care-filter-aggregate.png、mobile-care-filter.png |
| A38 三層級 | 實際切換三份來源；二次東京／全國一次與三次邊界；關閉後 fill/outline 均消失 | desktop-area1-national.png、desktop-area2-detail.png、desktop-area3-national.png、desktop-areas-hidden.png |
| A38 手機 | 邊界可讀、2020 STALE 與簡化／part 限制常駐圖例 | mobile-area2.png |
| 失效與重試 | 暫時使用不存在的本地 catalog；錯誤不顯示成零。恢復 byte-identical current，按重試後點位恢復 | mobile-error.png、mobile-retry-restored.png |

故障截圖保留測試當時的 JSON parse 訊息；最終已改為中文「資料目錄不是有效 JSON；請稍後重試」。開發過程 HMR 曾因 hook 結構修改報錯，完成後以完整 reload 驗證；2026-09-13 16:40 UTC 後讀取 console 沒有新增 error。不可用開發時的舊 console log 判斷乾淨載入失敗。

網路證據：[browser-network-summary.json](./browser-network-summary.json)、[browser-requests.jsonl](./browser-requests.jsonl)。共 211 筆醫療 HTTP 紀錄，151 個 PMTiles Range 請求、0 個無 Range PMTiles 請求；包含 59 個 206，其餘多為瀏覽器 304。沒有 IDWR/private/raw 請求。全國冷啟動觀察窗只有 current/catalog/aggregate 與 PMTiles header/root directory，沒有 hours；點選醫院後才觀察到 6e、b7 hours bucket。304 的 bytes=null 不代表下載零 bytes，也不是完整 HAR。臨時紀錄 middleware 已移除。

## A38 數量與保留限制

上游只讀 `areas-final-review.json`：一次／二次／三次 raw source parts 為 118,119／116,365／116,037。一次 PMTiles tilestats 為 118,120，不能當精確原始筆數；本批沿用來源 display artifact，沒有重新下載或重建成假精確統計。一次／二次內含 secondary code 335 種、名稱僅 305 種，不能用 name 去重。三次有 47 個 prefecture name、北海道 6 個非空 regional name，沒有捏造統一三次 code。

Popup 原樣顯示 A38 欄位，不為未取得官方欄位定義的數值猜測人口年份／單位。原始大 ZIP 不完整；所需三組 SHP 成員已在上游獨立取得。本批不聲稱已保存完整 ZIP。

## 程式與發布界線

[tests.log](./tests.log) 為完整 suite；[module-tests.log](./module-tests.log) 為最後修改後 13 項相關測試；[build.log](./build.log) 為最終 tsc + Vite build。build 仍有大 chunk 警告；`dist/jp-medical` 不存在，1.64GB 醫療 payload 不混入 app bundle。既有 476 keys 的 golden 資料保持一致，只新增 3 keys（總計 479）。

最後 readback 核對 `current.json` SHA-256：`2116f272cccae8be8e8e67fe9376adedabb4dda6d6c43482e1d5642061c2c649`。精確發布清單共 781 項，見 [payload-publication-plan.json](./payload-publication-plan.json)，其內 current 最後更新。只可按該清單發布；舊 release、原始/private 資料、screenshots/logs 都不在資料發布清單。

S3 upload/readback、CDN Range/cache headers、nginx 實際掛載、production browser、部署、commit、push、merge：**not run**。本地通過不等於正式環境已生效。
