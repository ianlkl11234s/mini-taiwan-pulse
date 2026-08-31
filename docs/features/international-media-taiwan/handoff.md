# Handoff — international-media-taiwan（前端）

> 上游設計 SSOT：`../../../../taipei-gis-analytics/docs/topic-research/gov_announcements/HANDOFF.md`
> 與 `../../../../.gis-agent-system/decisions/0012-realtime-qualitative-intel.md`。

## 前端落點

- `IntelPanel` 的「國際」tab；metadata-only 卡片清單，不是地圖 layer。
- Loader：`src/data/intlMediaTaiwanLoader.ts`。

- RPC：`public.get_intl_media_taiwan(p_since, p_limit, p_min_taiwan_relevance)`。
- 預設查詢：最近 7 天、最多 200 筆、`taiwan_relevance >= 2`；畫面再依 Intel replay 的 1h/6h/24h 視窗過濾。
- `source_country` 只顯示 registry 提供的值；null 時不從 TLD 猜國家。
- RPC 同時回傳兩套不可混用的位置語意：
  - `gkg_locations` 是 GDELT metadata 中「報導提及地點」，可多值且座標可缺。
  - `source_city/source_location_*` 是媒體或發布機關的來源錨點，方法明示為登錄資料、國家代表點或中央政府首都 fallback。

## 本機研究樣本預覽

- 僅在 Vite development mode 使用 `?intlMediaPreview=1` 啟用，例如
  `http://localhost:6002/?intlMediaPreview=1`。
- 啟用後預設開啟「國際」tab，載入 9 筆 2026-08-23～29 GDELT 研究樣本，
  且不受 1h／6h／24h 即時時間窗排除。
- 頁面會顯著標示「7 日研究樣本／非即時資料／不代表正式收錄」。fixture
  只有 GDELT metadata 與既有模型結構化判斷，沒有文章全文、模型 reason 或虛構摘要。
- production build 即使帶同一 query parameter 也不會啟用 fixture，正式 RPC 與 cache
  路徑維持不變。

## 時間與可信度語意

- `published_ts` 是 GDELT GKG record timestamp，不保證等於原媒體發布時間；UI 一律標「GDELT 收錄」。
- `importance` 是 LLM inferred 值；UI 標「AI 推估」，用中性色，不與 NCDR/CWA 警報 severity 的紅橙語意混用。
- Loader 只接受成對、finite 且在世界範圍內的經緯度；無效或單邊座標會一起降為 null，地點文字仍可保留。
- 卡片把「報導提及地點」與「媒體來源所在地／國家」分開顯示，來源 proxy 會標明登錄或推定，不能解讀成報導內容發生處。
- 本階段不接 Mapbox、不新增圖層、不飛行，也不送進既有 news cluster RPC。

## 驗收

- `npx vitest run src/data/__tests__/intlMediaTaiwanLoader.test.ts src/data/__tests__/intlMediaTaiwanPreview.test.ts src/components/intel/__tests__/IntlMediaCard.test.ts src/components/intel/__tests__/IntlMediaPreviewNotice.test.ts src/components/intel/alerts/__tests__/FeedTabs.test.ts`
- `npx vitest run src/data/__tests__/loadingRegistryContract.test.ts`
- `npx tsc -b`

Production RPC readback、collector freshness、部署與 browser 驗收仍是獨立 release gates；前端測試通過不代表上游資料已上線。
