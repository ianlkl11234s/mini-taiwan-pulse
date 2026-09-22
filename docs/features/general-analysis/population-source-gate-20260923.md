# A05 人口來源關卡：2025-12 SEGIS

狀態：`PASS_FOR_LOCAL_PREVIEW_ONLY`。本文件準備人口來源與 22 縣市 oracle；未建立 R2 artifact、selector、reader 或發布，因此 A05 尚未通過。

## 已核對來源

- 原始 receipt：`taipei-gis-analytics/data/raw/demographics/segis_2025_12/stat_12/Info.ini` 明示產品「114年12月行政區人口統計_鄉鎮市區」、全國、`U01TO` 與 `114Y12M`；`Schema.ini` 定義 `TOWN_ID`、`COUNTY_ID`、`P_CNT=人口數`、單位人。
- 原始 CSV 共 368 個不重複 `TOWN_ID`、22 個 `COUNTY_ID`，每筆 `INFO_TIME=114Y12M`；`P_CNT=M_CNT+F_CNT`，總人口 23,299,132。
- `population_by_township_20260530.parquet` 的 2025-12 368 筆，逐一以縣市／鄉鎮名稱與原始 `P_CNT` 相等。
- `TOWN_ID=TOWNCODE` 對上 368 筆 `township_boundary_20260626.geojson`；`COUNTY_ID=COUNTYCODE=行政區域代碼` 對上 22 筆 `county_boundary_20260626.geojson`。縣市 reference boundary 是 `COUNTY_MOI_1140318`。

原始 metadata 的口徑文字僅為「行政區人口統計」與「人口數」，沒有以「戶籍」或「現住」限定。因此 local preview 的唯一安全名稱是「2025-12 行政區人口數」；不得把舊文件或衍生檔的用詞回寫成原始 receipt 的定義。

## 可實作的 local-preview contract

`population_statistics / total_population / county`，固定 release `2025-12-total_population-county-local-preview`、期間 `2025-12-31`、單位人、dimensions `{ "population_scope": "total" }`、22/22 observed，並帶原始 CSV、parquet、county boundary 的 SHA-256 receipt。完整 JSON 由下列驗證器寫入隔離 worktree 的 `runtime/`。

```bash
python3 scripts/research/verify-population-source.py \
  --analytics-root /Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics
```

註冊 reader 前，需由上游把輸出轉為 immutable R2 artifact 加入 manifest/selector，並讀回 SHA／bytes／content type。現有 `compareRegions` 要分子與分母的 start/end period、boundary SHA 完全相同；全年服務統計與年底人口不能在未另寫且驗證對齊契約前 join。

## N02 local preview receipt

下列 builder 只讀已驗證的 source gate 與其原始／處理後 receipts，寫入隔離 worktree 的 `runtime/population-preview/`。它不產生 `current.json`、public manifest、selector 或 app reader；輸出 `regional-statistics-cdn-v1` 形狀的 content-addressed 22 縣市 artifact，以及 `local-preview-receipt.json`。

```bash
python3 scripts/research/build-population-preview.py \
  --source-gate ../runtime/population-source-gate-20260923.json \
  --output-dir ../runtime/population-preview
```

builder 自行重新雜湊 CSV、兩份 metadata、parquet、兩份 boundary，並檢查 county boundary 的 22 個 `行政區域代碼` 與輸出 22 個 `area_code` 完全相等、各列 observed/正值、加總 23,299,132、artifact readback SHA 等於檔名。來源標準名固定為「行政區人口數」、觀察日 `2025-12-31`、boundary `COUNTY_MOI_1140318`／SHA `5044636b840fba57230f15b6728030a09f3d6dc801a86c2301052514acc684d6`。

## `compareRegions` 契約缺口（不在本切片修改）

目前 `src/research/regionComparison.ts` 的 indicator allowlist 已接受 `total_population`，unit allowlist 已接受「人」，且唯一 `{ "population_scope": "total" }` 會通過 `totalPopulationDimensions`。但該函式把任意 value 為 `all`／`total`／`null` 的 object 都當人口分母，因此無法攜帶而且驗證「行政區人口」口徑。

上游接線時應把 generic predicate 改成嚴格 object schema：keys 必須且只能是 `population_scope` 與 `population_measure`，值固定為 `total` 與 `administrative_population`；缺 key、多 key 或其他值皆拒絕。這保留 raw receipt 能支持的「行政區人口」而不臆測戶籍／現住。同步加入測試：上述 exact object 接受；`{population_scope:"total"}`、任意 `all`、未知 key，以及 `population_measure:"registered_population"` 皆拒絕。

期間／boundary 的 strict equality 不應放寬。本 preview 只可和 `2025-12-31` 至 `2025-12-31`、相同 `COUNTY_MOI_1140318` SHA 的分子 join；日後若要使用年度服務統計，須另建明確 allowlisted alignment recipe，保存兩方 period 與 boundary fingerprint，並測試年度 period 不會因同年而自動接受。
