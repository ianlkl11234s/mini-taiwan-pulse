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

本批之後，優先量測日本醫療屬性／瓦片預算、waste stops 與 Ookla 視窗化。重建前列每欄 consumer，必要屬性與 geometry count 做前後比對；保留幾何來源與計數口徑。raw／history 保留、CDN Cache Rules、帳單仍按原生命周期計畫分階段治理，不建立另一套平行登記簿。

## 驗收

- `npx tsc -b` 通過。
- 前端整合測試：215 test files 通過、1 skipped；1,650 tests 通過、8 skipped。
- Python installer／publication／林業部署測試：19 通過，包含 current 切換失敗後可續跑、成功收斂與未知檔保留。
- 林業保留 PMTiles：2,030,870 bytes，SHA-256 `1f22e80b5e5e4dea9eef36f3e251d287f49d28966424d817729fbc2f251c77dc`，見 [baseline.json](./baseline.json)。
- shell 語法與 `git diff --check` 通過。
- 本地 nginx 1.27.4：9 個 HTTP cases 通過；/data 與 dist GeoJSON MIME＋gzip＋1 日 cache、JSON／JS／PNG MIME、PMTiles 206 且不 gzip、Ookla dist 優先、missing 404、private unknown path no-store。fixture config 與候選僅替換 listen/root，SHA 見 [nginx-runtime.json](./nginx-runtime.json)。這不代表正式 CDN 命中或已驗 private 授權。
- 部署／正式站結果另列。Cloudflare 公開 JSON cache eligibility 仍需 rules 權限／正式讀回確認。
