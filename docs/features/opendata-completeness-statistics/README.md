# 縣市開放資料完整度（30 天地圖挑戰 Day 18 NULL）

統計分頁新主題「政府與開放資料」→「開放資料完整度（Day 18 NULL）」→ 群組「縣市開放資料完整度」，口徑切換 5 層（縣市、單期 2026-10-30）：

| key | 口徑 | 單位 | 維度 |
|---|---|---|---|
| statsOpenDataDatasets | 縣市自己發布的資料集數（同名去重） | 筆 | 主題（全部＋18 類＋未分類；全部＝加總） |
| statsOpenDataCoordDatasets | 有座標或幾何的資料集數 | 筆 | 同上 |
| statsOpenDataCoordShare | 有座標比例 | % | — |
| statsOpenDataSpatialShare | 有任何空間資訊（座標＋地址＋只到行政區）比例 | % | — |
| statsOpenDataThemesWithCoords | 18 類中至少 1 筆座標資料的主題數 | 類 | — |

- 上游：analytics `pipelines/analysis/mapchallenge_2026_day18_null/07_export_statistics.py`、`docs/handoff/tw-opendata-completeness-recipes.json`；研究正本 `docs/topic-research/mapchallenge_2026_day18_null/07-county-completeness.md`。
- 交付：`scripts/statistics/build_roadmap_batch2_statistics_recipes.py --family openData`（本家族是衍生統計，授權與來源名稱照實寫，不套 data.gov.tw 單一資料集格式）。
- 口徑：目錄口徑，0／少＝本目錄查無，不代表縣市沒有公開；基隆、新竹縣、彰化、嘉義縣、屏東、花蓮、臺東、金門自有平台不在目錄內，新北、連江只收幾十列：筆數與主題數是下限，比例只代表目錄內收到的部分。
- 色票沿用公用事業 GnBu；資料集數兩層可切比例圓（總量），比率與主題數只給面量圖。
- 本機預覽（R2 未發布前）：`VITE_STATISTICS_CDN_BASE=http://127.0.0.1:<port>` 指向一個合併了 live manifest 與本 fragment 的本機 CDN（不改 `.env`、loader 或 vite.config）。
