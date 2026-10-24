# 文化幣藝文消費點 Culture Coin Venues

> **Slug**：`culture-coin-venues`（analytics topic：`culture_coin_venues`；Roadmap 第二批 G23）
> **狀態**：dev（PR 到 develop，未發布 master）
> **上線日期**：未發布
> **相關 PR**：見 changelog.md

## 一句話說明

文化主題新增「藝文消費」群組 1 層：可使用文化幣的藝文店家與場館 4,264 處，依 7 大類著色、可多選篩類別（電影院可單獨看）。靜態檔，不跟時間軸。

## 圖層

| 名稱（layer key） | 型態 | 檔案 | 筆數 | 出典／授權 |
|---|---|---|---|---|
| 文化幣藝文消費點（`cultureCoinVenues`） | 點 | `culture/culture_coin_venues.geojson`（2.6MB，gzip 約 190KB） | 4,264 | 文化部 文化幣（data.gov.tw 177601）／OGDL 1.0 |

類別（`category`）：書店及出版業 1,130、電影院 215、表演藝術及文化體驗 672、博物館 293、文資保存與社區營造場域 244、流行音樂 426、文創工藝 1,284。

## 資料流

analytics `data/processed/culture/culture_coin_venues_moc/`（analytics PR，G23）→ `scripts/preprocess/build-atlas-public.py`（`@layer("cultureCoinVenues")`，瘦身＋補 `source_org／source_url／license／fetched_at／vintage`）→ `public/culture/`（git 追蹤、隨 dist 部署）。前端沿用 atlas 圖層框架（`ATLAS_LAYER_COLORS`／`ATLAS_NOTES`／`ATLAS_LEGENDS`／`ATLAS_PANELS`）。Supabase `reference.culture_coin_venues`（gis-platform mig 479）給 MCP 倉庫與分析用，前端不讀。

選靜態檔不走 RPC 的理由：約 4 千點、半動態季更、沒有時間維度，與 G08（#624）、atlas 點線面（#585）同型。

重產：

```bash
python3 scripts/preprocess/build-atlas-public.py --src <analytics>/data/processed --only cultureCoinVenues
```

## 必要標示

- 資料日期是**下載日**（2026-10-24）：來源檔沒有日期欄，data.gov.tw metadata 停在 2026-05-13。彈窗列「資料下載日」，SourceFooter 帶取得日。
- 座標來源：彈窗「座標來源」列分「來源座標」與「來源座標為 (0,0)，依地址回補（精度）」；回補 342 處（離線地址比對 329、Google 13）。
- 來源座標落在其他縣市 5 處、落在海岸線外 4 處（綠島同址）：彈窗加注意列，座標未修正。
- 不含街頭藝人 550 筆（個人姓名＋登記地址，待使用者決定）；不含電話。

## 已知限制

- 與「文化設施」（文化部 emap）約 8.6% 重疊（多為書店），兩層並存、不去重。
- 6 筆子類是來源的泛稱（電影、影展、流行音樂），照原樣顯示。
- 名稱標籤 z15 起才顯示（點多）。
