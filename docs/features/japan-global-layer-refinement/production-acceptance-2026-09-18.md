# 日本／全球圖層微調 production 驗收（2026-09-18）

## 證據邊界

- 驗收站點：`https://mini-taiwan-pulse.itsmigu.com/`
- 驗收日期：2026-09-18 Asia/Taipei
- 瀏覽器：正式站實際互動；desktop 與 390 × 844 mobile viewport
- 本文件記錄 UI、HTTP 與資料契約結果；不把 Git merge、deployment `RUNNING` 或本機測試
  單獨視為 production 資料成功。

## 驗收結果

| 範圍 | Production 驗收 | 結果 |
|---|---|---|
| 日本入口 | 進入日本只移動視角，旅宿圖層維持關閉 | PASS |
| Loading | 實際載入醫療點位時，右上 loading pill 使用灰黑主視覺底色，無獨立藍底 | PASS |
| 旅宿 | canonical／OSM 點位在日本全國視角可見；類型有不同顏色；密度網格可獨立開啟；desktop、mobile、legend、popup、HTTP 206 與 console 已驗收 | PASS；詳見 `pr3-accommodation-production-acceptance.md` |
| 醫療設施 | 五類可獨立開關，z4.7 日本全國視角仍顯示完整點場；東京近景可辨識分類色；popup 保留類型、名稱、地址、snapshot、來源與 source id | PASS |
| 長照服務 | 六個使用情境可獨立開關，z4.7 日本全國視角仍顯示完整點場；近景分類色可辨識；popup 保留原始 `service_type`、地址、snapshot 與來源 | PASS |
| 醫療圈 | 一次／二次／三次醫療圈可獨立開關且配色不同；popup 明示 2020 `STALE`、行政規劃邊界、不是服務範圍或即時可達圈，polygon parts 不可相加 | PASS |
| 命名／分組 | 日本圖層使用「中文 日本語」且不重複加「日本」；全球圖層依語意主題分組，無空泛「世界」大分組 | PASS（desktop／mobile） |
| 不動產總市值 | 已由 icon rail app 移除，改為 Statistics 圖層；縣市與鄉鎮市區色階、opacity、legend、popup、missing-not-zero 均可操作 | PASS（desktop／390 × 844 mobile） |
| GFW 顯示語意 | UI 顯示完整 `YYYY-MM-DD UTC`、落後日數與 `STALE`；legacy daily Presence 標為 historical，不再把 `08/21` 顯示成不明的 `821` | PASS |
| GFW 新資料發布 | hotfix 部署後第一個可驗證的固定排程尚未到達；正式站仍是 canonical 2026-08-20、v3 2026-08-21 | PENDING，見 GFW freshness audit |

## 醫療設施資料守恆與互動

正式站同時開啟五類圖層時，sidebar 顯示 `醫療設施 5/5`；legend 與 catalog 對帳如下：

| 分類 | 來源列 | 可繪製 | 缺 geometry |
|---|---:|---:|---:|
| 醫院 | 7,715 | 7,447 | 268 |
| 診所 | 80,155 | 75,190 | 4,965 |
| 牙科 | 54,637 | 51,384 | 3,253 |
| 產科／助產 | 2,138 | 1,684 | 454 |
| 藥局 | 61,398 | 54,095 | 7,303 |

- 資料日期：2026-06-01。
- Legend 明示低縮放不抽樣；全國 z4.7 與東京 z12.5 實際顯示通過。
- Popup spot check：診所 `大手町プレイス内科`，顯示地址、2026-06-01 snapshot、
  厚生勞動省 Navii 與 source id。

## 長照服務資料守恆與互動

- Sidebar 同時開啟六類時顯示 `長照服務 6/6`：規劃諮詢、到宅、日間、住宿／短住、
  複合型、福祉用具。
- 來源日期 2026-07-09；來源 222,615 列，可繪製服務登記 222,194，nonspatial 416，
  duplicate quarantine 5。
- 35 個原始服務類別只分組一次。計數單位是「服務登記」，不是唯一機構數。
- Legend 明示低縮放保留全部登記；全國 z4.7 與東京 z14.5 實際顯示通過。
- Popup spot check：規劃諮詢分組下保留原始類型 `居宅介護支援`、地址、
  厚生勞動省 H17 與 2026-07-09 snapshot。

## 不動產總市值統計

- 縣市：coverage 19/22；來源未提供的金門、連江、澎湖維持灰色 missing，未著色為 0；
  嘉義市有來源值並正常 join。
- 鄉鎮市區：全台色階與行政邊界可見，legend 色帶與 popup 使用同一統計值。
- Popup spot check：花蓮縣秀林鄉，總市值 5,493 億元、6,061 棟、2,814,546 m²，
  行政區碼 `10015110`，並保留估值限制文案。
- 390 × 844 mobile 可從圖層 sheet 進入 Statistics、切換鄉鎮市區、調整 opacity 並閱讀說明。

## Browser／console

- 醫療、長照、醫療圈、房地產皆執行 All Off 後單獨或分類群組開啟。
- 日本全國與城市級、台灣縣市與鄉鎮市區、desktop 與 390 × 844 mobile 均已檢查。
- 驗收後 production console 的 warning／error 為 0。

## 唯一未閉合 gate：GFW 排程後 freshness

Collector hotfix 於 2026-09-18 12:38 Asia/Taipei 後才完成部署，而 publisher 固定每天
08:30 執行且 deployment 不會立即補跑。因此第一個能判定 hotfix 是否修復發布的時點是
2026-09-19 08:30 之後。需確認 ledger `succeeded`、v3 root 日期前進、immutable asset
SHA／bytes／Range 通過，且 Pulse 顯示相同新日期並移除 stale。詳細證據與判定規則見
[`../global-maritime/gfw-freshness-audit-2026-09-18.md`](../global-maritime/gfw-freshness-audit-2026-09-18.md)。
