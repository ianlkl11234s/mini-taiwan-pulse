# 資料輕量化與生命週期精簡

日期：2026-09-18。目標：用更少的展示資料、實體副本與前端工作，保留相同且可追溯的地圖功能。主 agent 負責決策／整合；Luna 定點盤點；Terra 負責交付及安裝器。本批不新增資料庫、快取服務或排程框架。

## 精簡原則

1. 原始資料與展示資料分工：原始資料按授權與重抓成本保留；展示產物只攜帶實際畫圖、篩選、點選與識別必要欄位。
2. 每個保留欄位要能指出 consumer 或資料契約。移除未使用欄位時改 producer，不在每個瀏覽器下載後才裁剪；新產物用新版本，不能覆寫 immutable 資產。
3. 共通來源／日期／授權可在 catalog 保存一次，但必須先讓所有 consumer 能正確取得；逐筆不同的時間、缺值、geometry 狀態不可誤合成全域常數。
4. 不為了移除幾個欄位新增 API、通用投影引擎或大量 detail shards。先刪真正未用的資料；只有有使用需求且量測顯示收益時，才把必要詳情拆出按需載入。
5. 刪空欄位之前先確認 absent 與 null 語意一致。保留 missing／suppressed／error／STALE／0 的差異；無座標不補 0,0。
6. 大幾何按視窗讀取；先減屬性，再評估分類分檔／聚合。聚合必須標示計數口徑；長照服務登記不等於機構數。不靜默抽稀或改變可用 zoom。
7. 暫存與正式安裝優先單份實體檔；驗證完成才發布 current。失敗保留 last-known-good，未知檔與舊 release 不由本批自動刪除。
8. 每個功能保留一個 canonical 實作。wrapper／cache／副本只有在保留契約或明確消費者需要時才存在；不靠新管理層解決可直接刪除的重複。

## 生命週期

官方來源 → raw＋取得紀錄 → processed＋驗證 → 精簡展示產物 → immutable release＋回讀 → current 最後切換 → CDN → browser／loader → Mapbox／popup → 依引用淘汰。

| 位置 | 用途 | 淘汰邊界 |
|---|---|---|
| analytics raw／S3 archive | 重建、追溯 | 依來源授權與可重抓性；先驗 SHA／bytes 並保存 archive receipt |
| intermediate／staging | 轉換、下載及發布途中 | 成功後精確清理；失敗／未知狀態保留供恢復 |
| processed | 正規化／分析與再產製 | 確認已發布版本可重建；PMTiles 不是分析原始資料的替代品 |
| Supabase current／history | 動態資料與有界查詢 | 每表明訂時窗及失效語意，查實際 cron 和資料時間 |
| S3／R2 release | 前端展示資產 | 保護 current、rollback、歷史引用及舊 session 寬限期；先 dry-run |
| Zeabur volume | 當前供應與恢復 | 消除重複 staging；不讓每次部署再堆一份；容量門檻含最大中間占用 |
| CDN／browser／loader | 可丟棄讀取快取 | 不是備份；immutable 與 mutable 分 TTL，loader cache 有容量界線 |

## 前端顯示的預算

首次進站只載必要 UI；開圖層才請求資料；大資料按視窗與 zoom 讀；點選才取得必要詳情；關閉後停止 polling、取消可取消的請求，避免無界保留 sources。單一瀏覽器的 Promise 去重不能替代跨訪客 CDN。

量測需分原檔 bytes、gzip／brotli bytes、單 tile bytes、視窗總 transfer、parse／long tasks 與記憶體；不能把 GeoJSON 減量百分比當成 PMTiles 或月費減量。每項比較使用相同筆數、篩選與 geometry。

## 本批範圍與後續

本批集中公開交付、醫療安裝 staging 及有證據的 payload 瘦身。醫療低 zoom 約 8 MB tile 的全量重建／LOD、整站 bundle 拆分、R2 搬遷、DB／收集器保留修復分階段處理，避免一次改整條鏈。

既有醫療 PR #297／#298 已完成的容量清理不重複計入本批收益。本批候選效果、本地測試、部署及正式 readback 必須分開記錄。

## 本批決策與實作

- **刪除舊林業公開副本**：`forest_reserve.geojson` 已無前端／分析 consumer；保留現行 `forest_reserve.pmtiles`，移除 upload entry 並在 pull 排除，避免舊 S3 物件被同步回新 volume。舊 S3／現有 volume 不在本批自動刪除。這會降低新 build 的 public/dist 體積，不會讓目前本就讀 PMTiles 的訪客再少下載 46.8 MB。
- **保留林道分析輸入**：`forest_roads.geojson` 被樹冠可達性 preprocessing 使用，不能只因前端讀 PMTiles 就刪除。
- **保留宗教三個欄位**：OSM／Wikidata 已僅有 `id/religion/name`，都是畫面消費所需；再減量要改按視窗讀取，不適合加詳情 API 或刪名稱。
- **醫療安裝只留一份新 payload**：驗證後同檔案系統移入 release，成功後清此次 known staging；避免完整 copy。跨 filesystem 明確拒絕；舊 release、未知檔保留。若資料發布者不遵守同一版本不可變契約仍拒絕覆寫。
- **統一公開 fallback 快取**：修共同 @dist 的 1 日 public cache，保留原有專用路由的來源優先順序；GeoJSON MIME／gzip 與一般 MIME 繼承一併驗證。mutable 名稱不新增 immutable，PMTiles 不進 gzip。

完整候選盤點見 [inventory.md](./inventory.md)。原始大小與 gzip 大小分開列；沒有逐列重建或正式讀回的資料不聲稱已減量。

## 恢復與後續

林業舊 GeoJSON 可由已存在的 Git commit 恢復供本地重建（不重寫 Git 歷史，也不是刪 raw archive）：

```sh
git show 08da5067:public/forestry/forest_reserve.geojson > /tmp/forest_reserve.geojson
```

前端 PMTiles bytes 應在本批保持不變。舊公開 GeoJSON URL 的外部使用者不在應用內 consumer 搜尋可證明範圍內，因此本批先停止新發布／同步，不刪既有 cloud object；若後續退役舊 URL，需先查使用紀錄及給定退役期。

後續大型候選為 waste stops 與 Ookla 視窗化；日本醫療預算與屬性盤點見本頁後續驗收。重建前列每欄 consumer，必要屬性與 geometry count 做前後比對；保留幾何來源與計數口徑。raw／history 保留、CDN Cache Rules、帳單仍按原生命周期計畫分階段治理，不建立另一套平行登記簿。

## 驗收

- `npx tsc -b` 通過。
- 前端整合測試：215 test files 通過、1 skipped；1,650 tests 通過、8 skipped。
- Python installer／publication／林業部署測試：19 通過，包含 current 切換失敗後可續跑、成功收斂與未知檔保留。
- 林業保留 PMTiles：2,030,870 bytes，SHA-256 `1f22e80b5e5e4dea9eef36f3e251d287f49d28966424d817729fbc2f251c77dc`，見 [baseline.json](./baseline.json)。
- shell 語法與 `git diff --check` 通過。
- 本地 nginx 1.27.4：9 個 HTTP cases 通過；/data 與 dist GeoJSON MIME＋gzip＋1 日 cache、JSON／JS／PNG MIME、PMTiles 206 且不 gzip、Ookla dist 優先、missing 404、private unknown path no-store。fixture config 與候選僅替換 listen/root，SHA 見 [nginx-runtime.json](./nginx-runtime.json)。這不代表正式 CDN 命中或已驗 private 授權。
- 部署／正式站結果另列；後續已補 Cloudflare UI rule readback，見下方成本與容量界線。


## 持續完成批次（2026-09-18）

本頁為本次工作唯一入口；證據與未完成條件逐項列在 [completion-ledger.md](./completion-ledger.md)，不另建快取服務或新的生命週期框架。

- 公開靜態供應：PR 304 正式部署讀回已通過；林業單一 immutable R2 試點已完整 SHA/bytes 回讀、Range/CORS/第二次 CDN HIT，前端使用同一 URL 常數。
- 前端：All Off 不載 LegendPanel；初始 JS import closure 實測 gzip 減少 41,407 bytes（不是整體流量百分比或瀏覽器耗時）。醫療預設低縮放只讀既有 z6 聚合，放大才掛完整 PMTiles；使用者仍能全縮放開完整點位。
- 動態上限：Global Events 每次最多 5 頁／1,000 列，明示 partial 與 continuation，換查詢/unmount 取消；禁止單頁超出契約後靜默截斷。靜態 CDN 失敗回錯誤，不再讓每個訪客自動改查 DB；14/14 正式資產已讀回。
- 收集器：串流 tar、member SHA/bytes receipt、遠端 identity 綁定、驗證後清理；有效 receipt 避免反覆壓縮及全檔 GET。磁碟滿不阻擋已有 receipt 的清理，未知本地檔案保留。
- 發布安裝：只需未完成 payload 的空間加 16 MiB 餘量，verified staging 可續跑，空間不足不切 current。
- Supabase：migration 412 保護水利署永久歷史、補 6 表保留登記、辨識已存在的 3/7 天 cleanup。新聞與直播歷史仍顯示 HOLD 告警，未以刪資料消除告警。

### 擴展下一個國家的准入條件

沿用既有 layer manifest、上游 DATA_LIFECYCLE 與平台 retention registry；每個新來源至少交付來源/授權、資料日期與更新頻率、source grain、raw 重抓成本、raw/展示/中間產物 bytes、欄位 consumer、geometry/missing 語意、負責 producer、失敗重試與保留窗口。未填 retention 的大型動態表不得默默上排程。

大點位先給低縮放明示聚合，再按視窗讀完整資料；大面用 PMTiles 與必要屬性。JSON 超出現有同類圖層預算時先量測 gzip/parse/memory，不以「換 CDN」當作瀏覽器負載已解決。immutable 檔先上傳並 SHA/bytes/readback，最後切 current；current/rollback/舊 session 引用期未過不得清 release。

### 成本與容量的操作界線

- 費用模型分開：儲存 GB-month、PUT/GET/HEAD/Range 次數、origin egress、冷層 retrieval、Supabase compute/egress、Zeabur volume/compute、Mapbox 使用量。快取降低回源，不代表大量訪客零成本。
- R2 Standard 官方價格目前為 $0.015/GB-month、Class A $4.50/百萬、Class B $0.36/百萬，Internet egress 不另計；free tier 為帳號共享，不能逐專案重複扣除。請以帳單當月用量、級距及 rounding 算實付，不把這次 2 MB 試點換算為已節省月費。[官方定價](https://developers.cloudflare.com/r2/pricing/)
- Origin 的 public Cache-Control 不等於 Cloudflare 已快取；需要實際 MISS/HIT/Age/Range 驗收。JSON 預設 eligibility 也需要 zone rule，不能只改 nginx。[官方預設快取行為](https://developers.cloudflare.com/cache/concepts/default-cache-behavior/)
- 共用 S3 bucket 現有全域 30 天 Standard-IA／90 天 Glacier-IR transition 未擅改；它也涵蓋其他專案。未取得各 prefix owner/讀取量前，不把整個 bucket 調整為展示層政策。新展示試點走 R2 Standard；S3 保留備份角色。
- 日常使用既有 health/daily report 追 retention coverage；news/yt HOLD 不隱藏。容量可操作門檻：共享 filesystem >=80% 或 free < 下一次完整工作集＋安全餘量要排查；>=90% 阻擋新增大產製。收集器 PR 93 已將 80%／90% 與剩餘空間加入既有 daily report；90% 停止新增大產製仍是操作門檻，不是新排程框架。
- Cloudflare UI readback（[cloudflare-console-readback.json](./cloudflare-console-readback.json)）：帳號 R2 為 8.8 GB，`mini-tw-pulse` 為 7.75 GB；本期（9/2–9/18 已觀測）UI 顯示 $0，累計儲存用量 4.5 GB-month，扣除內含額度後計費量為 0。既有 $10 budget alert 僅通知，非花費上限。此為 R2／Cloudflare 範圍，不能推論 AWS、Zeabur 或全服務費用皆為 $0。
- 同一 readback 已確認 Static map data rule 啟用且維持 respect-origin：`/jp-medical/current.json` 兩次 HIT（60s）、versioned `catalog.json` MISS→HIT（immutable）、`/world/jp_religion_gsi.pmtiles` 206 HIT；private no-store 路徑仍為 DYNAMIC，符合 `.pmtiles` 規則的 private missing path 仍為 BYPASS（僅負向快取檢查，不代表 private 授權驗收）。規則只追加主站醫療 current 與 release JSON，未變更 private-data 權限、bucket 或物件。
- `mini-tw-pulse` 唯一 lifecycle 為 7 天 abort 未完成 multipart upload，沒有 object expiration／刪除；歷史、source 與 rollback release 仍未清理。Cloudflare UI 已可讀，但既有 API token 仍不能管理 zone；AWS／Zeabur 發票也尚未驗證。


### 本批本地驗收結果

- `npx tsc -b`、Vite build 通過；仍有既存大型 chunk warning，未宣稱首包問題全解。
- 全套 218 files 首輪：215 passed、1 skipped、2 failed；失敗僅是林業 URL 的既有 golden/部署路徑斷言。已透過官方 regen 更新唯一一行 URL，部署契約改驗精確 R2 receipt＋本地 bytes/SHA，相關 35 tests 重驗全過。其餘 1,656 tests 首輪通過；正式 CI 再驗全套。
- installer/publication 19 tests 通過。
- browser-acceptance.json：林業 R2 顯示、醫療 z5 聚合與完整模式、z10 醫院/長照、真實 popup、All Off 均通過；無驗收狀態 console error。
- 醫療 aggregate catalog bytes：Navii 22,900、H17 151,147（共 174,047），避免低 zoom 預先掛兩份完整 PMTiles。完整點位 z5 實際觀察 13,159,430 bytes 的 Range responses，包含重複請求；不是完整 archive 大小，也不是冷啟動或普遍省量比率。


### 正式整合與後續顯示修正

PR 305 已一般合併為 `1c66aa24334d21d96560c643a685670b23e75ad4`，Zeabur 2026-09-18 09:02:48 UTC RUNNING；完整 CI 1,659 passed / 8 skipped。正式站 z5 醫療＋長照 aggregate、來源日期與計數口徑讀回通過；同格網雙 family 重疊另以螢幕位移＋「醫療／長照」標籤修正。

Collectors PR 92 已部署，正式 weather archive 24 members、1,100,426 bytes 全內容核對 verified；未執行清理。PR 93 容量日報已一般合併為 `fdb03902bdf59cd3681608dcb0ab2b70a131d954`，09:04:03 UTC RUNNING。Platform PR 113 / migration 412 已套用，6 表登記與 HOLD 告警讀回通過。水利署目前所有 observations（含新增列）均受保護；分開永久 backfill 與已封存滾動資料以前，這張表仍有成長風險，未宣稱已節省 DB 容量。

### 歷史冷封存與失敗暫存（2026-09-18）

三張歷史表完整 3,599,919 列已封存私人 S3 Deep Archive，CSV 731.35 MB 無損壓縮至 193.85 MB；全檔回讀 SHA 與轉冷後 checksum 通過。未刪 DB、未切前端查詢、未清 GFW。體積原因與還原限制見 [cold-archive.md](./cold-archive.md)，失敗 run 對帳見 [retention-spool-review.md](./retention-spool-review.md)。
