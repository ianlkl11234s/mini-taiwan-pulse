# Public 資產瘦身盤點（2026-09-18）

唯讀盤點 worktree `public/` 真檔；未把未追蹤檔或雲端版本當 production。gzip 為本機 `gzip -c` 結果，未代表 CDN transfer。

| 候選 | 原始／gzip | consumer／producer 證據 | 改法、不可刪語意、風險 |
|---|---:|---|---|
| `forestry/forest_reserve.geojson` | 46,783,425／16,201,818 bytes；522 features；11 properties | manifest 指向 `./forestry/forest_reserve.pmtiles`（`src/data/layerManifest.ts:3774-3781`）；perf 審查記錄 45MB→1.9MB PMTiles（`docs/perf-overhaul-2026-06.md:21-36`）。 | 先確認只剩舊 fallback，再移出 public；若重建 PMTiles，保留 polygon、`種類` filter、popup/來源語意。不要直接刪，因未做 runtime/離線驗收。 |
| `geo/ookla_fixed_global.geojson` | 23,044,097／2,486,292 bytes；70,666 features；8 properties | manifest 仍直接使用 GeoJSON URL（`src/data/layerManifest.ts:2348`）。本次未找到欄位消費清單，不能把任何欄位判為未用。 | fixed/mobile 共用 quadkey/z 分片或 PMTiles，保留速率、latency、devices/tests、coverage（`tile_count/z/coarse_quadkey`）；不可把聚合 grid 當原始測速點。收益主要來自按視窗載入。 |
| `geo/waste_stops_static.geojson` | 22,445,099／1,547,400 bytes；73,060 features；9 properties | producer 輸出路徑（`scripts/export/export_waste_stops_static.py:30`），欄位與 `routes_count` 累計（`:88-145`）；manifest URL（`src/data/layerManifest.ts:8198`）。實際 stops runtime consumer 尚待查；先前誤引的 `useWasteCleaningSquadLayer` 是清潔隊辦公點，不能作為 stops 證據。 | 按 city/quadkey 分片或 PMTiles；保留 stop/route identity、名稱、行政區、`vehicle_type/via`、`routes_count` 與缺值語意。不要刪 route 欄位；一站多路與計數會被破壞。producer 可重建，適合第一批實作，但須先補 consumer 驗證。 |

## 結論與邊界

優先做：①林業 GeoJSON 舊 fallback 清理驗證，②waste stops 分片/PMTiles，③Ookla fixed/mobile 共用分片。日本宗教／醫療 PMTiles 尚未讀 tile schema，不能聲稱有可刪欄位；日本水利 provenance（license、source URL/year、geometry role）不可因重複字串直接刪除。

補充否定結果（主 agent 量測）：`jp_religion_osm.geojson` 71,040 筆／10,929,140 bytes、Wikidata 37,154 筆／5,852,395 bytes 的 properties 都只有 `id/religion/name`，三欄皆為 consumer 所需，沒有可直接刪欄位；後續應評估 PMTiles，而非欄位刪除。

Checks：已完成前 12 大 `public` stat、三份 GeoJSON feature/property 抽樣、gzip 大小、manifest/hook/producer/既有 perf 行號查閱。未做 PMTiles schema、browser network/heap、production/CDN 或跨 repo producer 追蹤；沒有任何直接刪檔結論。本檔為唯一寫入物，未修改程式或雲端。
