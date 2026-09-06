# 統計圖層 handoff

2026-09-06：本機3734已驗收，最新完整記錄：[跨夜驗收](../../../../taipei-gis-analytics/docs/topic-research/regional_statistics/overnight-acceptance.md)。

statsWasteCounty／statsRecyclingCounty由regionalStatisticsRecipes、Store、Loader及MapView附掛renderer處理。兩期、獨立toggle、來源、opacity、legend、popup均可用。沿用LayersPanel大分組／小分組；統計All Off為scoped keys。

本機VITE_STATISTICS_API_URL=http://localhost:3735；預設未設時用Supabase public RPC。remote migration尚未apply，不可移除override後宣稱正式可用。public/statistics縣界僅本機驗收；正式需Storage資產+hashmanifest。

擴充其他地理層級須先有對應geometry與資料，当前兩recipe只提供county，不捏造township。固定數值色階與透明度已支援，任意色階編輯、伺服器端分享選期、正式排程尚待後續工作。
