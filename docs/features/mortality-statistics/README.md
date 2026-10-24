# 死因統計 Mortality Statistics（G20）

> **Slug**：`mortality-statistics`
> **狀態**：dev（等 PR review）
> **Owner**：migu
> **相關 PR**：#（待補）
> **上游**：taipei-gis-analytics `docs/topic-research/mortality_statistics/`（layer-plan.md）＋ `docs/handoff/mortality-statistics-recipes.json`（DB／R2 交付 receipt）

## 一句話說明

衛福部統計處死因統計（data.gov.tw 5965）做成 Statistics 分頁「醫療與長照 → 死因統計」一個群組、6 個口徑，可切死因（全死因＋42 類）、性別（人數層）、期別。

## 圖層（6 層，一個群組「地理層級／口徑」）

| layer key | 指標 | 層級 | 維度 |
|---|---|---|---|
| `statsMortalityCauseTownship`（**預設**） | 粗死亡率（110–114 年 5 年平均） | 鄉鎮 368 | 死因 |
| `statsMortalityDeaths5yrTownship` | 死亡人數（5 年合計） | 鄉鎮 | 死因、性別 |
| `statsMortalityRateTownship` | 粗死亡率（逐年） | 鄉鎮 | 死因 |
| `statsMortalityDeathsTownship` | 死亡人數（逐年） | 鄉鎮 | 死因、性別 |
| `statsMortalityCauseCounty` | 粗死亡率（逐年） | 縣市 22 | 死因 |
| `statsMortalityDeathsCounty` | 死亡人數（逐年） | 縣市 | 死因、性別 |

`deaths_total(_5yr)` 與 `deaths_by_cause` 的 cause=all、sex=all 逐筆相等（產生器會驗），所以不另開「總死亡數」層。

## 設計重點

1. **不遮蔽**（PLAN §0 #5）。0 是真值（當期無死亡），斜線是「不適用」（COVID-19 108 年以前）或「無資料」（分母戶籍人口缺），兩者分開標示，不會變成 0。
2. **預設看 5 年平均**，圖例提醒小鄉鎮單年波動大、不要拿來排名。
3. **圖例必寫**：出典衛福部統計處＋政府資料開放授權條款第 1 版；粗死亡率未做年齡標準化；分母是 12 月底戶籍人口（衛福部全國粗死亡率用年中人口，數值略有差異）；死因分類 109 年起 42 類。
4. **固定門檻**：每個（死因[, 性別]）組合各自一組，取最新期別的分位數（2 位有效數字）；人數層有 0 時第一級固定為 1。
5. **按需載入**：3,863 個 exact selector（recipe JSON 約 1.4 MB，gzip 約 42 KB）不進首屏；首屏只帶 `.catalog.json`（約 116 KB），明細在第一次開啟時 dynamic import。原本只有 taipeiAgency 走這條路，本 PR 把它泛化成 `ATLAS_LAZY_FAMILIES` ＋ `atlasLazyFamily(key)`。

## 重產

```bash
python3 scripts/statistics/build_mortality_statistics_recipes.py \
  --recipes <analytics>/docs/handoff/mortality-statistics-recipes.json --root <analytics>
npx tsx scripts/statistics/build_statistics_recipe_catalogs.ts
```

## 已知限制

- 切換口徑時期別沿用既有「最接近期別」邏輯：5 年平均（2021–2025）切到縣市逐年會落在 2021 年，不是最新的 2025 年。
- 彈窗「資料限制」列顯示的是 DB 交付的中文說明，英日文介面也是中文（既有統計圖層都是這樣）。
