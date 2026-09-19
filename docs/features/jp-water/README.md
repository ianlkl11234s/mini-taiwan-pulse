# 日本水資源圖層

狀態：四個既有 GeoJSON 為 `PRODUCTION_VERIFIED`；全國八個 PMTiles 圖層已改為 `OWNER_ONLY_PRIVATE_PENDING_RELEASE`。後者不進 public/CDN，只能透過同域認證 Range API 讀取；代碼、資產上傳、部署與 production 瀏覽器驗收分開記錄。

| layer key | geometry | source snapshot | 語意 |
|---|---|---|---|
| jpWaterDams | point | W01 2014 | ダム位置；非即時蓄水量 |
| jpWaterLakes | polygon | W09 2005 | 湖沼範圍歷史快照 |
| jpWaterSupplyFacilities | point | P21 2010 | 上水道設施，含泵場/管理中心；不可全稱淨水場 |
| jpWaterSupplyAreas | polygon | P21 2010 | 給水區域歷史範圍 |
| jpWaterSewerFacilities | point | P22 2012 | 下水處理廠/泵場，需保留來源分類 |
| jpWaterRivers | line | W05 2006–2009 | 河川線歷史快照 |
| jpWaterLocalPipes | line | 半田市 source-specific | 半田地方範圍；CRS已驗，但尚未接線 |
| jpWaterLocalFacilities | point | 高松市 source-specific | 地方供排水相關設施，含下水道設施 |
| jpWaterQualityStations | point | 環境省 2024 | 12,274 raw / 9,831 distinct stations；站表不是水質測值 |
| jpWaterLevelStations | point | 未註（站表 URL 2024-07-05） | 水位觀測站；2026-03 僅屬另一觀測表，不可套到站表 |

資料契約與 release boundary 見 [handoff.md](./handoff.md)。

## 2026-09-18 全國本地接線（LOCAL_ONLY）

- 上游資料 commit：`1e90db6c`；本機資產為 `water.pmtiles`（85,597,875 bytes／`dd82b5…8737da`）與 `extra-water.pmtiles`（31,656,052 bytes／`e41775…a5bf9`）。production 會 fail-closed，不回退 localhost。
- 上水道設施依 2010 P21 日文名稱保守分類，未命中者明示為未分類；下水道依 2012 P22a／P22b 來源子型分成泵場與處理場。popup 會同時顯示分類依據。
- 新增水壩、河川、上水道設施／給水區、下水道、GSJ地下水等、NILIM水壩、MAFF農業蓄水池；既有湖泊不重複。核心為歷史基線；GSJ實際24縣／年份未註，NILIM實際46縣／年份未註，MAFF datum未知且4,284同座標列保留。
- GSI「洪水浸水想定（最大規模）」為預設關閉的官方 raster（z2–17）；空白不是無風險，並非即時災情或預報，圖例直接嵌官方 legend，不手抄色階。
- 目前視窗沒有要素只代表該視窗空白；不將已驗證的全國 source feature count 改寫為0或無風險結論。

## 2026-09-18 production receipt

- Zeabur deployment [`6aace0570f50de6ff52c3469`](./evidence/production-deployment.json) 已在 `2026-09-18T07:01:08Z` 完成並為 `RUNNING`，對應 master merge commit `5fdde19d`。
- 正式站 `/world/jp_water/release.json` 和四個 GeoJSON 都回應 HTTP 200；SHA-256、bytes 與 feature count 均符合 release metadata：詳見 [HTTP readback](./evidence/production-readback.json)。
- Native Chrome 已驗 Japan 選單的「水資源 1/4」、四個 toggle 與「水資源靜態資料」分類，以及實際 geometry、popup、來源、授權與 URL layer selection：琵琶湖、上野、トーヨー橋、旧御殿水源地；已移除的資料處理欄位未恢復。詳見 [browser receipt](./evidence/production-browser.json)。實體行動裝置未驗。

## 2026-09-19 owner-only 讀取邊界

- 八個全國向量層會顯示在 sidebar，但非固定 owner 會維持鎖定；真正防線是 server 每個 Range 重驗 Supabase 身分與 session revoke。
- 只允許 `/api/private-research/jp-water/{water|extra-water}`；回應 `private, no-store`，無公開物件 URL、無 nginx static fallback，也不進 share/embed/snapshot/replay。
- 資產依然是靜態 PMTiles，不查 Supabase 地理資料；Supabase 只做身分驗證。
- 「只有本人可讀」可把實際外流面降很低，但不會自動消除來源條款解釋的不確定性，也無法防止 owner 自己共享帳號或 token。
