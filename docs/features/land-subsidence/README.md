# 地層下陷與海堤 Land Subsidence & Seawalls（＋毒化物併入污染設施彈窗）

> **Slug**：`land-subsidence`（analytics topic：`land_subsidence`；Roadmap 第一批 G19）
> **狀態**：dev（PR 到 develop，未發布 master）
> **上線日期**：未發布
> **相關 PR**：見 changelog.md
> **規格 SSOT**：analytics `docs/topic-research/land_subsidence/layer-plan.md`、`toxic-vs-ems-comparison.md`

## 一句話說明

水資源主題新增「地層下陷與海堤」群組 4 層（測站、累積／速率等值線、一般性海堤區域），全部是靜態檔、不跟時間軸；測站彈窗用 RPC 畫近 10 年月平均趨勢。毒化物不獨立成層，併進「污染潛勢設施」彈窗。

## 圖層

| 名稱（layer key） | 型態 | 檔案 | 筆數 | 出典／授權 |
|---|---|---|---|---|
| 地層下陷監測站（`landSubsidenceStations`） | 點 | `hazards/land_subsidence_stations.geojson`（89 KB） | 112／113 | 經濟部水利署（data.gov.tw 36693／41571／58335）／OGDL 1.0 |
| 累積下陷量等值線（`landSubsidenceCumulative`） | 線 | `hazards/land_subsidence_contours.pmtiles`（3.2 MB，z5–13，與速率共用） | 507（最新期 125） | 經濟部水利署（data.gov.tw 58361）／OGDL 1.0 |
| 平均下陷速率等值線（`landSubsidenceRate`） | 線 | 同上 | 189（最新期 41） | 經濟部水利署（data.gov.tw 58362）／OGDL 1.0 |
| 一般性海堤區域（`seawallZones`） | 面 | `hazards/seawall_zones.geojson`（573 KB） | 239 | 經濟部水利署（data.gov.tw 129277，上游建置 2024-06-12）／OGDL 1.0 |

檔案放 `public/hazards/`（沿用既有 nginx `/hazards/` fallback 與 S3 pull；不另開 `water/` 目錄，`deployContract` 測試會要求新目錄補 nginx 與 pull script）。

## 資料流

- 點線面：analytics `data/processed/water_resources/{land_subsidence_stations,land_subsidence_contours,seawall_zones_wra}/`（G19 資料層）→ `scripts/preprocess/build-land-subsidence-public.py`（只瘦身＋補 `source_org／source_url／license／fetched_at／vintage`）→ `public/hazards/`（git 追蹤、隨 dist 部署）。
- 測站趨勢：`supabase.rpc('get_land_subsidence_timeseries', { p_station_id: id, p_from: null, p_to: null, p_bucket: 'month' })`（gis-platform mig 474；anon 可執行；預設最新一筆往回 10 年）。`src/data/landSubsidenceLoader.ts`，30 分快取；popup lazy，列入 `loadingRegistryContract` 豁免。
- 毒化物：analytics `data/raw/hazards/toxic_chemical_facilities/`（EMS_S_05）→ `scripts/preprocess/build-toxic-permits-lookup.py` → `public/environment/toxic_permits/{首字母}.json`（25 片，共 450 KB，最大 70 KB）＋`_chems.json`＋`_meta.json`。點污染設施時依 `emsno` 首字母 lazy fetch（`src/data/toxicPermitsLoader.ts`），**不重建 `pollution_facilities.pmtiles`**。

重產：

```bash
python3 scripts/preprocess/build-land-subsidence-public.py --src <analytics>/data/processed/water_resources --date 20261017
python3 scripts/preprocess/build-toxic-permits-lookup.py --raw <analytics>/data/raw/hazards/toxic_chemical_facilities
```

期別選單 `CONTOUR_PERIODS`（`src/data/landSubsidenceTypes.ts`）由預處理腳本印出後貼上；資料更新出現新 fname 時要同步。

## 等值線 PMTiles 逐 zoom 稽核

`tippecanoe -l contours -Z5 -z13 --no-tile-size-limit --no-feature-limit`（不用 `--drop-densest`），依唯一 `id`（`fname:序號`）數條數，應有 696：

| z5 | z6 | z7 | z8 | z9–z13 |
|---|---|---|---|---|
| 681 | 688 | 692 | 695 | 696 ✓ |

z5–z8 少的是極短的閉合小圈（例：`TW9899:3`、`TP83112:18`、`YL81104:9`），小於一個像素被 tippecanoe 簡化掉；不調參數湊齊，圖例說明寫「低縮放（< 9 級）少數短線不顯示」。

## 毒化物 lookup 規則

- 鍵＝`upper(trim(emsno))`；彈窗「命中才顯示」，不以 `is_toxic`／`sev_toxic` 推斷（語意不同，見比對檔）。
- 化學物質、運作行為：該設施**最新出現的一季**（`roc_year-season`）去重；彈窗列前 6 種＋「等 N 種」，英日文顯示上游英文名 `emi_ename`。
- 有效許可＝**同一最新季**中 `per_status=='有效'` 的許可文號去重數；效期＝那些列 `edate` 最大值。`per_status` 是該季申報當下的狀態，跨季累加會把已過期許可算成「有效」，所以不跨季。`per_status` 空值是「使用／輸入」等申報類的正常狀態。
- 資料期：彈窗列該設施的最新季（例「民國115年第2季」），舊設施可能停在 101 年等較早期別，照實顯示。`season=0` 是年度釋放量申報（上游只有「釋放量」用 0），顯示「民國N年（年度釋放量申報）」；最新期落在年報的設施 179 個。
- 合併：2026-07 全量 CSV 只取 ≤ 114 年第 3 季；115 年第 1、2 季用 2026-10-17 重抓（MOENV API v2 `ems_s_05`，115-1 舊檔 21,751 列、重抓 26,792 列＝舊檔該季不完整）。重抓檔與 receipt 在 analytics `data/raw/hazards/toxic_chemical_facilities/ems_s_05_115s2/`（gitignored）。
- 不帶：座標（以污染設施為準）、統編 `unino`、許可文號、數量。
- 命中：lookup 6,835 個編號，與污染設施（analytics `pollution_facilities_20260706.geojsonseq`，與 PMTiles 同 SHA）交集 **6,531**；其中資料期 115-2 有 2,231、115-1 689。

## 必要標示（語意守門）

- 測站：時間是上游台灣當地日期字串，原樣顯示（不 +8）；GNSS 趨勢畫「相對首月 mm」；磁環預設畫最大環號、可下拉換環；深層樁標「單位上游未註明」；`obs_count=0` 的 7 站不打 RPC、顯示「無監測資料」（RPC 回 0 列同句）；`coord_status≠valid` 顯示座標說明；彈窗尾列「單站量測不代表整個地區；三類不可互比」。
- 金湖國小 GNSS（上游座標錯，UDI-0039）不上圖。
- 等值線：負值＝下陷（紅系）、0 灰、正值＝抬升（藍系）；`sign_corrected` 加註「上游原以正值表示下陷，已統一為負值」；`exclude_from_map`（TW_109 33 條）不上圖；預設 `is_latest=true`，期別選單另有「全部期別（重疊）」與各縣市各期。
- 海堤：`org` 新舊名混用，`org_label` 正規化為「第N河川分署」；與上游原值不同時另列「上游原值」；`seawall_type`、`note` 不顯示；minzoom 8。

## 與 layer-plan 的偏差

- 等值線**不加線上 level_value 文字標註**：repo 記錄 PMTiles source 上掛 symbol 在 production 有 `continuePlacement` 崩潰前例（`overlayRegistry.ts` publicLifePointOverlay 註解），值改放彈窗與圖例。
- 輸出目錄用 `public/hazards/` 而非 layer-plan 範例的 `public/water/`（理由見上）。
- 累積／速率拆兩個圖層 key（共用一個 PMTiles source，layer id 以 suffix 區分），各自有期別選單與圖例。

## 已知限制

- 同座標疊放的測站（例：土庫國中 (1)(2)(3)、中科虎尾 (1)(2) 深層樁）點擊只會開最上層一站。
- 測站趨勢圖是自製 SVG（`TimeseriesSparkline` 多日範圍只標 M/D，十年圖看不出年份）。
- 速率等值線缺期：2015–2017 全台圖（上游只有 SHP、未取得）、2018–2019 全台圖上游無值。
- `pollution_facilities.pmtiles` 本身不在 git（S3 部署）；本功能只新增 lookup JSON。
